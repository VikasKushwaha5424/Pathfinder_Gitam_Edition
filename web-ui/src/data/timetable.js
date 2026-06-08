const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Each entry: { start, end, subject, location, room }
// location must match a CAMPUS_LOCATIONS id
// start/end in 24h format 'HH:MM'

const DEFAULT_TIMETABLE = {
  monday: [
    { start: '09:00', end: '10:00', subject: 'DBMS', location: 'cse_department', room: 'Lab 101' },
    { start: '10:15', end: '11:15', subject: 'Mathematics', location: 'cse_department', room: 'Hall A' },
    { start: '11:30', end: '12:30', subject: 'Computer Networks', location: 'cse_department', room: 'Lab 102' },
  ],
  tuesday: [
    { start: '09:00', end: '10:00', subject: 'Software Engineering', location: 'cse_department', room: 'Hall B' },
    { start: '10:15', end: '11:15', subject: 'DBMS Lab', location: 'cse_department', room: 'Lab 101' },
    { start: '14:00', end: '15:00', subject: 'Operating Systems', location: 'cse_department', room: 'Hall A' },
  ],
  wednesday: [
    { start: '09:00', end: '10:00', subject: 'Computer Networks', location: 'cse_department', room: 'Lab 102' },
    { start: '10:15', end: '11:15', subject: 'Mathematics', location: 'cse_department', room: 'Hall A' },
    { start: '11:30', end: '12:30', subject: 'Soft Skills', location: 'auditorium', room: 'Main Hall' },
  ],
  thursday: [
    { start: '09:00', end: '10:00', subject: 'Operating Systems', location: 'cse_department', room: 'Hall A' },
    { start: '10:15', end: '11:15', subject: 'DBMS', location: 'cse_department', room: 'Lab 101' },
    { start: '14:00', end: '16:00', subject: 'Sports', location: 'sports_complex', room: 'Ground' },
  ],
  friday: [
    { start: '09:00', end: '10:00', subject: 'Software Engineering', location: 'cse_department', room: 'Hall B' },
    { start: '10:15', end: '11:15', subject: 'Computer Networks Lab', location: 'cse_department', room: 'Lab 102' },
    { start: '11:30', end: '12:30', subject: 'Library', location: 'library', room: 'Reading Hall' },
  ],
  saturday: [],
  sunday: [],
};

export function getTimetable() {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem('maya_timetable'));
  } catch {
    stored = null;
  }
  return stored || DEFAULT_TIMETABLE;
}

export function setTimetable(timetable) {
  try {
    localStorage.setItem('maya_timetable', JSON.stringify(timetable));
  } catch {
    /* silently fail */
  }
}

function getDayName(date) {
  return DAYS[date.getDay()];
}

function getTimeString(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function getCurrentClass(timetable, date) {
  const day = getDayName(date);
  const time = getTimeString(date);
  const classes = timetable[day] || [];
  return classes.find((c) => time >= c.start && time < c.end) || null;
}

export function getNextClass(timetable, date) {
  const day = getDayName(date);
  const time = getTimeString(date);
  const classes = timetable[day] || [];
  return classes.find((c) => time < c.start) || null;
}

export function minutesUntil(startTime, date) {
  const [h, m] = startTime.split(':').map(Number);
  const target = new Date(date);
  target.setHours(h, m, 0, 0);
  return Math.round((target - date) / 60000);
}


