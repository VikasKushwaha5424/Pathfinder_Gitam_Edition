import json
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

import state
from engine.pathfinding import find_path
from engine.poi_search import find_node_id, get_all_names

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    text: str
    session_id: str = 'default'
    location: str = ''
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None

@router.post('/generate')
async def generate_response(req: ChatRequest):
    if not req.text.strip():
        async def err_gen():
            yield f"data: {json.dumps({'text': 'I didn\'t hear anything — could you say that again?', 'route': None})}\n\n"
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    npc = 'maya'
    history = await state.get_or_create_session(req.session_id, npc)
    system_prompt = state.NPC_PROMPTS.get(npc, "You are Maya, a helpful campus guide.")

    location_note = f"The user is at: {req.location.replace('_', ' ').title()}" if req.location else ''

    NAVIGATE_TOOL = {
        'type': 'function',
        'function': {
            'name': 'find_route',
            'description': 'Find the shortest walking path to a campus location. Call this when the user asks for directions, navigation, or how to get somewhere.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'destination': {
                        'type': 'string',
                        'description': f'The destination name. Valid locations: {", ".join(get_all_names())}',
                    },
                    'accessibility': {
                        'type': 'string',
                        'description': 'Accessibility needs: wheelchair, no_stairs, or no_keycard. Omit if not needed.',
                    },
                },
                'required': ['destination'],
            },
        },
    }

    messages = [{'role': 'system', 'content': system_prompt}]
    for msg in history[-6:]:
        messages.append(msg)

    user_prompt = location_note + f"\nUser says: {req.text}" if location_note else f"User says: {req.text}"
    messages.append({'role': 'user', 'content': user_prompt})

    import asyncio
    
    async def event_generator():
        max_retries = 3
        response = None
        
        for attempt in range(max_retries):
            try:
                response = await state.groq_client.chat.completions.create(
                    model=state.groq_model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=300,
                    tools=[NAVIGATE_TOOL],
                    tool_choice='auto',
                    stream=True,
                )
                break
            except Exception as e:
                err = str(e).lower()
                if '429' in err or 'quota' in err or 'exhausted' in err or 'rate limit' in err:
                    if attempt == max_retries - 1:
                        yield f"data: {json.dumps({'text': 'The network is a bit crowded, give me a second.'})}\n\n"
                        return
                    await asyncio.sleep(0.5 * (2 ** attempt))
                else:
                    try:
                        # Fallback without tools if tool_use_failed
                        response = await state.groq_client.chat.completions.create(
                            model=state.groq_model,
                            messages=messages,
                            temperature=0.7,
                            max_tokens=300,
                            stream=True,
                        )
                        break
                    except:
                        yield f"data: {json.dumps({'text': 'Sorry, I am having trouble connecting to my brain.'})}\n\n"
                        return
                        
        if not response:
            yield f"data: {json.dumps({'text': 'The network is a bit crowded, give me a second.'})}\n\n"
            return

        full_text = ""
        tool_calls = []
        
        try:
            async for chunk in response:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                
                if delta.content:
                    full_text += delta.content
                    yield f"data: {json.dumps({'text': delta.content})}\n\n"
                    
                if delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        while len(tool_calls) <= tc_delta.index:
                            tool_calls.append({"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                        tc = tool_calls[tc_delta.index]
                        if tc_delta.id:
                            tc["id"] += tc_delta.id
                        if tc_delta.function.name:
                            tc["function"]["name"] += tc_delta.function.name
                        if tc_delta.function.arguments:
                            tc["function"]["arguments"] += tc_delta.function.arguments
        except (Exception, asyncio.CancelledError) as e:
            yield f"data: {json.dumps({'text': ' [Connection Interrupted]'})}\n\n"

        route_data = None
        if tool_calls:
            for tc in tool_calls:
                if tc['function']['name'] == 'find_route':
                    try:
                        args = json.loads(tc['function']['arguments'])
                        dest = args.get('destination', '')
                        to_node = find_node_id(dest)
                        if not to_node:
                            yield f"data: {json.dumps({'text': f'I could not find a location named {dest} on campus.'})}\n\n"
                            continue
                        from_node = find_node_id(req.location) or req.location or ''
                        if not from_node:
                            yield f"data: {json.dumps({'text': 'I need your location to give directions. Please select a starting point.'})}\n\n"
                            continue
                        filters = {}
                        acc = args.get('accessibility', 'none')
                        if acc == 'wheelchair':
                            filters['wheelchair'] = True
                        elif acc == 'no_stairs':
                            filters['noStairs'] = True
                        elif acc == 'no_keycard':
                            filters['noKeycard'] = True
                            
                        from fastapi.concurrency import run_in_threadpool
                        result = await run_in_threadpool(find_path, from_node, to_node, filters)
                        
                        if result['path']:
                            coords = [[p['lat'], p['lng']] for p in result['path']]
                            route_data = {
                                'from': from_node,
                                'to': to_node,
                                'coordinates': coords,
                                'distance': result['distance'],
                                'steps': result['steps'],
                            }
                            yield f"data: {json.dumps({'route': route_data})}\n\n"
                            
                            if not full_text:
                                loc_name = dest.replace('_', ' ').title()
                                steps_text = '. '.join(result['steps'])
                                reply_text = f"Pinging {loc_name} on your HUD. {steps_text}. Total distance: {result['distance']} meters."
                                full_text = reply_text
                                yield f"data: {json.dumps({'text': reply_text})}\n\n"
                                
                        history.append({
                            'role': 'tool',
                            'content': json.dumps({'distance': result.get('distance', 0), 'steps': result.get('steps', [])}),
                            'tool_call_id': tc['id'],
                        })
                    except Exception as e:
                        logger.error(f"Route tool call failed: {e}")
                        yield f"data: {json.dumps({'text': 'I had trouble finding that route. Please try again.'})}\n\n"
        
        history.append({'role': 'user', 'content': req.text})
        if full_text:
            history.append({'role': 'assistant', 'content': full_text})
        if len(history) > 10:
            del history[:-10]
            
        await state.save_session(req.session_id, npc, history)
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
