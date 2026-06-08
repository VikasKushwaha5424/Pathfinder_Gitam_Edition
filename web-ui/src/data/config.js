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

export const NPC_LIST = {
  maya: { name: 'Maya (Campus Guide)', color: '#4CAF50' },
  professor: { name: 'Professor Mehta', color: '#2196F3' },
  silas: { name: 'Silas (Facilities)', color: '#f44336' },
};

export const API_BASE = import.meta.env.VITE_API_BASE || '';
