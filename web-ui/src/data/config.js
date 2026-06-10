export const CAMPUS_LOCATIONS = [
  { id: '', name: '📍 Auto Detect' },
  { id: 'library', name: 'Library', lat: 17.782078, lng: 83.377342, posterHeading: 0 },
  { id: 'admin_block', name: 'Admin Block', lat: 17.781178, lng: 83.379191, posterHeading: 0 },
  { id: 'cse_department', name: 'CS Department', lat: 17.780486, lng: 83.376235, posterHeading: 0 },
  { id: 'canteen', name: 'Canteen', lat: 17.783407, lng: 83.379935, posterHeading: 0 },
  { id: 'sports_complex', name: 'Sports Complex', lat: 17.783211, lng: 83.378911, posterHeading: 0 },
  { id: 'auditorium', name: 'Auditorium', lat: 17.781841, lng: 83.377170, posterHeading: 0 },
  { id: 'hostel_block', name: 'Hostels', lat: 17.783780, lng: 83.378555, posterHeading: 0 },
  { id: 'parking', name: 'Parking', lat: 17.780280, lng: 83.379079, posterHeading: 0 },
  { id: 'room_a_loc', name: 'Room A (Test)', lat: 0, lng: 0, posterHeading: 0 },
  { id: 'hallway_loc', name: 'Hallway (Test)', lat: 0.000045, lng: 0, posterHeading: 0 },
  { id: 'living_room_loc', name: 'Living Room (Test)', lat: 0.000045, lng: 0.000072, posterHeading: 0 },
];

export const CAMPUS_POI = [
  { name: 'Gate 1 (Front Gate)', lat: 17.781208, lng: 83.380597 },
  { name: 'Dental College & Hospital', lat: 17.780454, lng: 83.378693 },
  { name: 'CV Raman Bhavan (Science)', lat: 17.780346, lng: 83.377096 },
  { name: 'Cricket Stadium', lat: 17.782697, lng: 83.379580 },
  { name: 'Tennis Court', lat: 17.783765, lng: 83.379062 },
  { name: 'Rabindranath Sadan (RBS)', lat: 17.783780, lng: 83.378555 },
  { name: 'Vinay Sadan', lat: 17.783574, lng: 83.378203 },
  { name: 'Gitam School of Law', lat: 17.783140, lng: 83.378135 },
  { name: 'Humanities & Social Sciences', lat: 17.783333, lng: 83.377750 },
  { name: 'GSB (Business School)', lat: 17.782797, lng: 83.377749 },
  { name: 'Balayogi Kala Pranganam', lat: 17.782804, lng: 83.378070 },
  { name: 'GITAM Bus Stop', lat: 17.782013, lng: 83.378279 },
  { name: 'GITAM Central Parking', lat: 17.781677, lng: 83.377633 },
  { name: 'Venture Development Centre', lat: 17.783114, lng: 83.376434 },
  { name: 'Gate 2 (Back Gate)', lat: 17.783199, lng: 83.375774 },
  { name: 'NTR Park', lat: 17.782170, lng: 83.375980 },
  { name: 'Sir Arthur Cotton Bhavan', lat: 17.781206, lng: 83.376845 },
  { name: 'ICT Bhavan', lat: 17.780486, lng: 83.376235 },
  { name: 'Nirman Bhavan', lat: 17.780324, lng: 83.375896 },
  { name: 'Visvesvaraya Bhavan (VB)', lat: 17.781383, lng: 83.375346 },
  { name: 'School of Architecture', lat: 17.780901, lng: 83.374791 },
  { name: 'Civil Engineering', lat: 17.780766, lng: 83.374705 },
  { name: 'CXR Labs', lat: 17.780720, lng: 83.375319 },
  { name: 'Pharmacy Bhavan', lat: 17.780065, lng: 83.374783 },
  { name: 'Executive Residence', lat: 17.780694, lng: 83.373966 },
  { name: 'Swechha Waldorf School', lat: 17.781126, lng: 83.374435 },
];

export const CAMPUS_NODES = [
  // ── Micro-test graph (room → hallway → living_room) ──
  { id: 'room_a', label: 'Room A', type: 'anchor', lat: 0, lng: 0 },
  { id: 'hallway', label: 'Hallway', type: 'anchor', lat: 0.000045, lng: 0 },
  { id: 'living_room', label: 'Living Room', type: 'anchor', lat: 0.000045, lng: 0.000072 },

  // ── Anchor nodes (AR poster locations) ──
  { id: 'node_library', label: 'Library Entrance', type: 'anchor', lat: 17.782078, lng: 83.377342 },
  { id: 'node_admin', label: 'Admin Block Entrance', type: 'anchor', lat: 17.781178, lng: 83.379191 },
  { id: 'node_cse', label: 'CS Department Entrance', type: 'anchor', lat: 17.780486, lng: 83.376235 },
  { id: 'node_canteen', label: 'Canteen Entrance', type: 'anchor', lat: 17.783407, lng: 83.379935 },
  { id: 'node_sports', label: 'Sports Complex', type: 'anchor', lat: 17.783211, lng: 83.378911 },
  { id: 'node_auditorium', label: 'Auditorium', type: 'anchor', lat: 17.781841, lng: 83.377170 },
  { id: 'node_hostel', label: 'Hostel Block', type: 'anchor', lat: 17.783780, lng: 83.378555 },
  { id: 'node_parking', label: 'Parking', type: 'anchor', lat: 17.780280, lng: 83.379079 },

  // ── Waypoints (turn / junction points with no poster) ──
  { id: 'wp_lib_admin_path', label: 'Library-Admin Path', type: 'waypoint', lat: 17.781700, lng: 83.378200 },
  { id: 'wp_admin_parking_path', label: 'Admin-Parking Path', type: 'waypoint', lat: 17.780800, lng: 83.379100 },
  { id: 'wp_lib_aud_path', label: 'Library-Auditorium Path', type: 'waypoint', lat: 17.781900, lng: 83.377200 },
  { id: 'wp_aud_cse_path', label: 'Auditorium-CSE Path', type: 'waypoint', lat: 17.781100, lng: 83.376700 },
  { id: 'wp_lib_sports_path', label: 'Library-Sports Path', type: 'waypoint', lat: 17.782600, lng: 83.378100 },
  { id: 'wp_sports_canteen_path', label: 'Sports-Canteen Path', type: 'waypoint', lat: 17.783300, lng: 83.379500 },
  { id: 'wp_sports_hostel_path', label: 'Sports-Hostel Path', type: 'waypoint', lat: 17.783500, lng: 83.378700 },

  // ── CS Department Indoor ──
  { id: 'node_cse_entrance', label: 'CS Dept Entrance (Inside)', type: 'waypoint', lat: 17.780486, lng: 83.376235, building: 'cse_department', floor: 0 },
  { id: 'node_cse_corridor', label: 'CS Dept Corridor', type: 'waypoint', lat: 17.780500, lng: 83.376235, building: 'cse_department', floor: 0 },
  { id: 'node_cse_lab101', label: 'CS Lab 101', type: 'anchor', lat: 17.780510, lng: 83.376245, building: 'cse_department', floor: 0 },
  { id: 'node_cse_lab102', label: 'CS Lab 102', type: 'anchor', lat: 17.780520, lng: 83.376250, building: 'cse_department', floor: 0 },
  { id: 'node_cse_lecture_hall', label: 'CS Lecture Hall A', type: 'anchor', lat: 17.780495, lng: 83.376245, building: 'cse_department', floor: 0 },
  { id: 'node_cse_faculty', label: 'CS Faculty Room', type: 'anchor', lat: 17.780505, lng: 83.376240, building: 'cse_department', floor: 0 },
  { id: 'node_cse_server', label: 'CS Server Room', type: 'anchor', lat: 17.780515, lng: 83.376240, building: 'cse_department', floor: 0 },
  { id: 'node_cse_stairs', label: 'CS Stairs', type: 'waypoint', lat: 17.780510, lng: 83.376225, building: 'cse_department', floor: 0 },
  { id: 'node_cse_elevator', label: 'CS Elevator', type: 'waypoint', lat: 17.780515, lng: 83.376228, building: 'cse_department', floor: 0 },
  { id: 'node_cse_restroom', label: 'CS Restroom', type: 'anchor', lat: 17.780525, lng: 83.376255, building: 'cse_department', floor: 0 },
  { id: 'node_cse_printer', label: 'CS Printer Room', type: 'anchor', lat: 17.780530, lng: 83.376250, building: 'cse_department', floor: 0 },

  // ── Library Indoor ──
  { id: 'node_lib_entrance', label: 'Library Entrance (Inside)', type: 'waypoint', lat: 17.782078, lng: 83.377342, building: 'library', floor: 0 },
  { id: 'node_lib_reading_hall', label: 'Library Reading Hall', type: 'anchor', lat: 17.782060, lng: 83.377360, building: 'library', floor: 0 },
  { id: 'node_lib_stacks_ground', label: 'Library Book Stacks (Ground)', type: 'anchor', lat: 17.782090, lng: 83.377380, building: 'library', floor: 0 },
  { id: 'node_lib_stacks_first', label: 'Library Book Stacks (First)', type: 'anchor', lat: 17.782090, lng: 83.377390, building: 'library', floor: 1 },
  { id: 'node_lib_digital', label: 'Library Digital Section', type: 'anchor', lat: 17.782050, lng: 83.377320, building: 'library', floor: 0 },
  { id: 'node_lib_reference', label: 'Library Reference Section', type: 'anchor', lat: 17.782070, lng: 83.377350, building: 'library', floor: 0 },
  { id: 'node_lib_librarian', label: "Librarian's Office", type: 'anchor', lat: 17.782085, lng: 83.377365, building: 'library', floor: 0 },
  { id: 'node_lib_periodicals', label: 'Library Periodicals', type: 'anchor', lat: 17.782095, lng: 83.377375, building: 'library', floor: 0 },
  { id: 'node_lib_issue', label: 'Library Issue Counter', type: 'anchor', lat: 17.782065, lng: 83.377335, building: 'library', floor: 0 },
  { id: 'node_lib_self_checkout', label: 'Library Self Checkout', type: 'anchor', lat: 17.782075, lng: 83.377345, building: 'library', floor: 0 },
  { id: 'node_lib_restroom', label: 'Library Restroom', type: 'anchor', lat: 17.782100, lng: 83.377370, building: 'library', floor: 0 },
  { id: 'node_lib_exit_canteen', label: 'Library Exit (to Canteen)', type: 'waypoint', lat: 17.782105, lng: 83.377385, building: 'library', floor: 0 },
];

export const CAMPUS_EDGES = [
  // ── Micro-test edges ──
  { source: 'room_a', target: 'hallway', distance: 5, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'hallway', target: 'living_room', distance: 8, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // ── Campus edges (undirected — pathfinding builds adjacency for both directions) ──
  // Library ←→ Admin via waypoint
  { source: 'node_library', target: 'wp_lib_admin_path', distance: 35, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'wp_lib_admin_path', target: 'node_admin', distance: 40, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // Admin ←→ Parking
  { source: 'node_admin', target: 'wp_admin_parking_path', distance: 30, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'wp_admin_parking_path', target: 'node_parking', distance: 25, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // Library ←→ Auditorium
  { source: 'node_library', target: 'wp_lib_aud_path', distance: 20, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'wp_lib_aud_path', target: 'node_auditorium', distance: 15, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // Auditorium ←→ CSE
  { source: 'node_auditorium', target: 'wp_aud_cse_path', distance: 25, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'wp_aud_cse_path', target: 'node_cse', distance: 20, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // CSE ←→ Parking (shortcut path)
  { source: 'node_cse', target: 'node_parking', distance: 45, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // Library ←→ Sports via waypoint
  { source: 'node_library', target: 'wp_lib_sports_path', distance: 40, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'wp_lib_sports_path', target: 'node_sports', distance: 25, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // Sports ←→ Canteen
  { source: 'node_sports', target: 'wp_sports_canteen_path', distance: 15, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'wp_sports_canteen_path', target: 'node_canteen', distance: 20, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // Sports ←→ Hostel
  { source: 'node_sports', target: 'wp_sports_hostel_path', distance: 20, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'wp_sports_hostel_path', target: 'node_hostel', distance: 15, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // Library ←→ Canteen (direct path through sports)
  { source: 'wp_lib_sports_path', target: 'node_canteen', distance: 55, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // Admin ←→ Hostel (cross-campus path)
  { source: 'node_admin', target: 'node_hostel', distance: 80, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // ── CS Department Indoor ──
  { source: 'node_cse', target: 'node_cse_entrance', distance: 3, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_cse_entrance', target: 'node_cse_corridor', distance: 5, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_cse_corridor', target: 'node_cse_lab101', distance: 8, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_cse_corridor', target: 'node_cse_lab102', distance: 12, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_cse_corridor', target: 'node_cse_lecture_hall', distance: 10, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_cse_corridor', target: 'node_cse_faculty', distance: 8, isStairs: false, requiresKeycard: true, hasRamp: true, hasElevator: false },
  { source: 'node_cse_corridor', target: 'node_cse_server', distance: 12, isStairs: false, requiresKeycard: true, hasRamp: true, hasElevator: false },
  { source: 'node_cse_corridor', target: 'node_cse_stairs', distance: 15, isStairs: true, requiresKeycard: false, hasRamp: false, hasElevator: false },
  { source: 'node_cse_corridor', target: 'node_cse_elevator', distance: 18, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: true },
  { source: 'node_cse_corridor', target: 'node_cse_restroom', distance: 20, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_cse_corridor', target: 'node_cse_printer', distance: 15, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },

  // ── Library Indoor ──
  { source: 'node_library', target: 'node_lib_entrance', distance: 3, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_lib_entrance', target: 'node_lib_reading_hall', distance: 8, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_lib_entrance', target: 'node_lib_digital', distance: 10, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_lib_entrance', target: 'node_lib_issue', distance: 5, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_lib_entrance', target: 'node_lib_reference', distance: 15, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_lib_entrance', target: 'node_lib_periodicals', distance: 20, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_lib_reading_hall', target: 'node_lib_stacks_ground', distance: 12, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_lib_reading_hall', target: 'node_lib_librarian', distance: 15, isStairs: false, requiresKeycard: true, hasRamp: true, hasElevator: false },
  { source: 'node_lib_reference', target: 'node_lib_librarian', distance: 8, isStairs: false, requiresKeycard: true, hasRamp: true, hasElevator: false },
  { source: 'node_lib_reference', target: 'node_lib_restroom', distance: 10, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_lib_issue', target: 'node_lib_self_checkout', distance: 6, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_lib_periodicals', target: 'node_lib_exit_canteen', distance: 8, isStairs: false, requiresKeycard: false, hasRamp: true, hasElevator: false },
  { source: 'node_lib_stacks_ground', target: 'node_lib_stacks_first', distance: 5, isStairs: true, requiresKeycard: false, hasRamp: false, hasElevator: false },
];

export const NPC_LIST = {
  maya: { name: 'Maya (Campus Guide)', color: '#4CAF50' },
  professor: { name: 'Professor Mehta', color: '#2196F3' },
  silas: { name: 'Silas (Facilities)', color: '#f44336' },
};

export const API_BASE = import.meta.env.VITE_API_BASE || '';
