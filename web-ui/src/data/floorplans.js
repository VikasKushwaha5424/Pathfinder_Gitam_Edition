// Floor plan config: maps location IDs to SVG floor plan images + room markers
// Coordinates are in SVG pixel space (800x600 viewBox)

export const FLOOR_PLANS = {
  cse_department: {
    src: '/floorplans/cse_department.svg',
    width: 800,
    height: 600,
    label: 'CS Department — Ground Floor',
    rooms: [
      { name: 'Lab 101', x: 170, y: 125, desc: 'DBMS Lab — 30 seats' },
      { name: 'Lab 102', x: 410, y: 125, desc: 'Networks Lab — 30 seats' },
      { name: 'Stairs', x: 560, y: 125, desc: 'To First Floor' },
      { name: 'Elevator', x: 625, y: 85, desc: 'All Floors' },
      { name: 'Restroom', x: 695, y: 85, desc: 'Gents' },
      { name: 'Lecture Hall A', x: 220, y: 300, desc: 'Capacity 60 — DS, Algorithms' },
      { name: 'Faculty Room', x: 510, y: 300, desc: 'Dr. Sharma, Dr. Patel' },
      { name: 'Server Room', x: 685, y: 262, desc: 'Restricted Access' },
      { name: 'Printer Room', x: 685, y: 342, desc: 'Self Service' },
      { name: 'Entrance', x: 130, y: 430, desc: 'Main Door' },
      { name: 'Corridor', x: 465, y: 430, desc: '→ Lab 103, HOD Office' },
    ],
  },

  library: {
    src: '/floorplans/library.svg',
    width: 800,
    height: 600,
    label: 'Knowledge Resource Centre — Ground Floor',
    rooms: [
      { name: 'Reading Hall', x: 210, y: 130, desc: 'Silent Study — 80 seats' },
      { name: 'Book Stacks A–F', x: 490, y: 110, desc: 'Ground Floor' },
      { name: 'Book Stacks G–L', x: 490, y: 145, desc: 'First Floor' },
      { name: 'Restroom', x: 670, y: 85, desc: 'Gents' },
      { name: 'Restroom', x: 670, y: 175, desc: 'Ladies' },
      { name: 'Digital Library', x: 170, y: 310, desc: '20 PCs, Printing, Scanning' },
      { name: 'Reference Section', x: 420, y: 310, desc: 'Encyclopedias, Dictionaries' },
      { name: "Librarian's Office", x: 640, y: 272, desc: 'Mr. Rao' },
      { name: 'Exit → Canteen', x: 640, y: 350, desc: 'Rear Exit' },
      { name: 'Periodicals', x: 390, y: 440, desc: 'Newspapers, Magazines' },
      { name: 'Main Entry', x: 150, y: 515, desc: 'Gate' },
      { name: 'Issue Counter', x: 370, y: 515, desc: 'Check Out / Return' },
      { name: 'Self Checkout', x: 550, y: 515, desc: 'Automated' },
    ],
  },

  admin_block: {
    src: '/floorplans/admin_block.svg',
    width: 800,
    height: 600,
    label: 'Administrative Block — Ground Floor',
    rooms: [
      { name: 'Registrar Office', x: 210, y: 115, desc: 'Admissions, Transcripts, Counter 1–3' },
      { name: 'Fees Office', x: 475, y: 115, desc: 'Tuition, Scholarships, Counter 4–5' },
      { name: 'Restroom', x: 655, y: 80, desc: 'Gents' },
      { name: 'Restroom', x: 655, y: 150, desc: 'Ladies' },
      { name: 'Exam Cell', x: 170, y: 275, desc: 'Hall Tickets, Results' },
      { name: 'HR Department', x: 420, y: 275, desc: 'Faculty, Staff Affairs' },
      { name: 'Printer', x: 640, y: 240, desc: 'Self Service' },
      { name: 'Stairs', x: 640, y: 310, desc: '→ First Floor' },
      { name: 'VC Office', x: 210, y: 425, desc: 'By Appointment, Sec: Ms. Lakshmi' },
      { name: 'Meeting Room', x: 510, y: 425, desc: 'Capacity 20' },
      { name: 'Main Entry', x: 150, y: 530, desc: 'Gate' },
      { name: 'Reception', x: 375, y: 530, desc: 'Information Desk' },
      { name: 'Security', x: 570, y: 530, desc: 'Security Desk' },
    ],
  },
};

export function hasFloorPlan(locationId) {
  return !!FLOOR_PLANS[locationId];
}

export function getFloorPlan(locationId) {
  return FLOOR_PLANS[locationId] || null;
}
