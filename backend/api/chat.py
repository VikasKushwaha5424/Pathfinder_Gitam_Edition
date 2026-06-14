import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from openai import BadRequestError

import state
from engine.pathfinding import find_path
from engine.poi_search import find_node_id, get_all_names

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
        return {'text_response': "I didn't hear anything — could you say that again?", 'route': None}

    npc = 'maya'
    history = state.get_or_create_session(req.session_id, npc)
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
            )
            break
        except BadRequestError as e:
            err_body = str(e.body).lower() if e.body else ''
            is_tool_fail = 'tool_use_failed' in err_body or 'failed_generation' in err_body
            if is_tool_fail:
                response = await state.groq_client.chat.completions.create(
                    model=state.groq_model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=300,
                )
                break
            else:
                raise HTTPException(500, detail=str(e))
        except Exception as e:
            err = str(e).lower()
            if '429' in err or 'quota' in err or 'exhausted' in err or 'rate limit' in err:
                if attempt == max_retries - 1:
                    return {'text_response': "The network is a bit crowded, give me a second.", 'route': None}
                await asyncio.sleep(0.5 * (2 ** attempt))
            else:
                import traceback
                traceback.print_exc()
                raise HTTPException(500, detail=str(e))
                
    if not response:
        return {'text_response': "The network is a bit crowded, give me a second.", 'route': None}

    choice = response.choices[0].message
    reply_text = choice.content or ''
    route_data = None

    if choice.tool_calls:
        for tc in choice.tool_calls:
            if tc.function.name == 'find_route':
                try:
                    args = json.loads(tc.function.arguments)
                    dest = args.get('destination', '')
                    to_node = find_node_id(dest) or dest
                    from_node = find_node_id(req.location) or req.location or ''
                    filters = {}
                    acc = args.get('accessibility', 'none')
                    if acc == 'wheelchair':
                        filters['wheelchair'] = True
                    elif acc == 'no_stairs':
                        filters['noStairs'] = True
                    elif acc == 'no_keycard':
                        filters['noKeycard'] = True
                    result = find_path(from_node, to_node, filters)
                    if result['path']:
                        coords = [[p['lat'], p['lng']] for p in result['path']]
                        route_data = {
                            'from': from_node,
                            'to': to_node,
                            'coordinates': coords,
                            'distance': result['distance'],
                            'steps': result['steps'],
                        }
                        if not reply_text:
                            loc_name = dest.replace('_', ' ').title()
                            steps_text = '. '.join(result['steps'])
                            reply_text = f"Pinging {loc_name} on your HUD. {steps_text}. Total distance: {result['distance']} meters."
                    history.append({
                        'role': 'tool',
                        'content': json.dumps({'distance': result.get('distance', 0), 'steps': result.get('steps', [])}),
                        'tool_call_id': tc.id,
                    })
                except Exception:
                    import traceback
                    traceback.print_exc()

    history.append({'role': 'user', 'content': req.text})
    assistant_msg = choice.model_dump(exclude_none=True)
    history.append(assistant_msg)
    if len(history) > 10:
        del history[:-10]
        
    state.save_session(req.session_id, npc, history)

    return {'text_response': reply_text, 'route': route_data}
