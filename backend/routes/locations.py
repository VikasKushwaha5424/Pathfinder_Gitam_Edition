from fastapi import APIRouter

router = APIRouter()

CAMPUS_LOCATIONS = {
    "library": {
        "description": "GITAM Central Library — quiet study zones, book sections, and digital resources",
        "lat": 17.782078,
        "lng": 83.377342,
    },
    "admin_block": {
        "description": "Administrative Block — admissions, fees, registrar, and student services",
        "lat": 17.781178,
        "lng": 83.379191,
    },
    "cse_department": {
        "description": "Computer Science & Engineering Department — labs, faculty offices, and lecture halls",
        "lat": 17.780486,
        "lng": 83.376235,
    },
    "canteen": {
        "description": "University Canteen & Food Court — snacks, meals, and refreshments",
        "lat": 17.783407,
        "lng": 83.379935,
    },
    "sports_complex": {
        "description": "Sports Complex — indoor courts, gymnasium, and outdoor fields",
        "lat": 17.783211,
        "lng": 83.378911,
    },
    "auditorium": {
        "description": "Main Auditorium — events, seminars, and cultural programs",
        "lat": 17.781841,
        "lng": 83.377170,
    },
    "hostel_block": {
        "description": "Student Hostels — accommodation, warden office, and common rooms",
        "lat": 17.783780,
        "lng": 83.378555,
    },
    "parking": {
        "description": "Campus Parking — visitor parking, bike stands, and shuttle stop",
        "lat": 17.780280,
        "lng": 83.379079,
    },
}


@router.get("/locations")
async def get_locations():
    return CAMPUS_LOCATIONS
