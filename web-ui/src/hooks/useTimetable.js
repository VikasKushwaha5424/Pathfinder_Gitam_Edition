import { useState, useEffect, useCallback } from 'react';
import { getTimetable, setTimetable as saveTimetable, getCurrentClass, getNextClass, minutesUntil } from '../data/timetable';

export default function useTimetable() {
  const [timetable, setTimetable] = useState(getTimetable);
  const [currentClass, setCurrentClass] = useState(null);
  const [nextClass, setNextClass] = useState(null);
  const [minsToNext, setMinsToNext] = useState(null);
  const [autoDestination, setAutoDestination] = useState(null);

  const update = useCallback(() => {
    const now = new Date();
    const current = getCurrentClass(timetable, now);
    const next = getNextClass(timetable, now);
    setCurrentClass(current);
    setNextClass(next);

    if (next) {
      const mins = minutesUntil(next.start, now);
      setMinsToNext(mins);
      // Auto-set destination if class starts within 5 minutes
      if (mins <= 5 && mins > 0) {
        setAutoDestination(next.location);
      } else {
        setAutoDestination(null);
      }
    } else {
      setMinsToNext(null);
      setAutoDestination(null);
    }

    // If currently in a class, suggest the location
    if (current) {
      setAutoDestination(current.location);
    }
  }, [timetable]);

  useEffect(() => {
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [update]);

  const updateTimetable = useCallback((newTimetable) => {
    setTimetable(newTimetable);
    saveTimetable(newTimetable);
  }, []);

  return {
    currentClass,
    nextClass,
    minsToNext,
    autoDestination,
    updateTimetable,
  };
}
