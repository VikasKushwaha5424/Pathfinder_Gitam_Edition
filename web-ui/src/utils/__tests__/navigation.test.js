import { describe, it, expect } from 'vitest';
import { calculateBearing, calculateDistance, computeTurnAngle, getDirectionLabel, getTurnIntensity, getVerticalDirection } from '../navigation';

describe('calculateBearing', () => {
  it('returns 0 for due north', () => {
    const b = calculateBearing(0, 0, 1, 0);
    expect(b).toBeCloseTo(0, 0);
  });

  it('returns 90 for due east', () => {
    const b = calculateBearing(0, 0, 0, 1);
    expect(b).toBeCloseTo(90, 0);
  });

  it('returns 180 for due south', () => {
    const b = calculateBearing(0, 0, -1, 0);
    expect(b).toBeCloseTo(180, 0);
  });

  it('returns 270 for due west', () => {
    const b = calculateBearing(0, 0, 0, -1);
    expect(b).toBeCloseTo(270, 0);
  });

  it('normalizes to 0-360 range', () => {
    const b = calculateBearing(0, 0, -1, 0);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });

  it('returns 0 for same start and end point', () => {
    const b = calculateBearing(10, 20, 10, 20);
    expect(b).toBe(0);
  });
});

describe('calculateDistance', () => {
  it('returns ~111km for 1 degree latitude', () => {
    const d = calculateDistance(0, 0, 1, 0);
    expect(d).toBeCloseTo(111195, -3);
  });

  it('returns 0 for same point', () => {
    const d = calculateDistance(10, 20, 10, 20);
    expect(d).toBe(0);
  });

  it('distance is symmetric', () => {
    const d1 = calculateDistance(0, 0, 1, 1);
    const d2 = calculateDistance(1, 1, 0, 0);
    expect(d1).toBeCloseTo(d2, 0);
  });

  it('returns positive for negative deltas', () => {
    const d = calculateDistance(1, 1, 0, 0);
    expect(d).toBeGreaterThan(0);
  });
});

describe('computeTurnAngle', () => {
  it('returns positive for right turn (north then east)', () => {
    const angle = computeTurnAngle(
      0, 0,   // prev: origin
      1, 0,   // curr: north of prev (bearing 0)
      1, 1    // next: east of curr (bearing 90) = right turn
    );
    expect(angle).toBeGreaterThan(0);
  });

  it('returns negative for left turn (east then north)', () => {
    const angle = computeTurnAngle(
      0, 0,   // prev: origin
      0, 1,   // curr: east of prev (bearing 90)
      1, 1    // next: north of curr (bearing 0) = left turn
    );
    expect(angle).toBeLessThan(0);
  });

  it('returns ~0 for straight line', () => {
    const angle = computeTurnAngle(
      0, 0,
      0, 1,
      0, 2
    );
    expect(Math.abs(angle)).toBeLessThan(5);
  });

  it('returns ~180 for uturn', () => {
    const angle = computeTurnAngle(
      0, 0,
      0, 1,
      0, 0
    );
    expect(Math.abs(angle)).toBeGreaterThan(170);
  });

  it('returns 0 when all three points are identical', () => {
    const angle = computeTurnAngle(10, 20, 10, 20, 10, 20);
    expect(angle).toBe(0);
  });

  it('returns 0 when prev and curr are identical', () => {
    const angle = computeTurnAngle(10, 20, 10, 20, 11, 20);
    expect(angle).toBe(0);
  });
});

describe('getDirectionLabel', () => {
  it('returns Turn Around for >=150', () => {
    expect(getDirectionLabel(150)).toBe('Turn Around');
    expect(getDirectionLabel(160)).toBe('Turn Around');
    expect(getDirectionLabel(180)).toBe('Turn Around');
  });

  it('returns Turn Around for <=-150', () => {
    expect(getDirectionLabel(-150)).toBe('Turn Around');
    expect(getDirectionLabel(-160)).toBe('Turn Around');
    expect(getDirectionLabel(-180)).toBe('Turn Around');
  });

  it('returns Turn Right for >30 and <150', () => {
    expect(getDirectionLabel(45)).toBe('Turn Right');
    expect(getDirectionLabel(90)).toBe('Turn Right');
    expect(getDirectionLabel(149)).toBe('Turn Right');
  });

  it('returns Turn Left for <-30 and >-150', () => {
    expect(getDirectionLabel(-45)).toBe('Turn Left');
    expect(getDirectionLabel(-90)).toBe('Turn Left');
    expect(getDirectionLabel(-149)).toBe('Turn Left');
  });

  it('returns Go Straight for small angles', () => {
    expect(getDirectionLabel(0)).toBe('Go Straight');
    expect(getDirectionLabel(15)).toBe('Go Straight');
    expect(getDirectionLabel(-15)).toBe('Go Straight');
    expect(getDirectionLabel(30)).toBe('Go Straight');
    expect(getDirectionLabel(-30)).toBe('Go Straight');
  });
});

describe('getTurnIntensity', () => {
  it('returns sharp for >120', () => {
    expect(getTurnIntensity(150)).toBe('sharp');
    expect(getTurnIntensity(-150)).toBe('sharp');
    expect(getTurnIntensity(121)).toBe('sharp');
  });

  it('returns moderate for 60-120', () => {
    expect(getTurnIntensity(90)).toBe('moderate');
    expect(getTurnIntensity(-90)).toBe('moderate');
    expect(getTurnIntensity(60)).toBe('moderate');
    expect(getTurnIntensity(120)).toBe('sharp');
  });

  it('returns gentle for 30-60', () => {
    expect(getTurnIntensity(45)).toBe('gentle');
    expect(getTurnIntensity(-45)).toBe('gentle');
    expect(getTurnIntensity(31)).toBe('gentle');
    expect(getTurnIntensity(59)).toBe('gentle');
  });

  it('returns straight for <30', () => {
    expect(getTurnIntensity(0)).toBe('straight');
    expect(getTurnIntensity(15)).toBe('straight');
    expect(getTurnIntensity(29)).toBe('straight');
    expect(getTurnIntensity(-29)).toBe('straight');
  });
});

describe('getVerticalDirection', () => {
  it('returns Go Upstairs when toFloor > fromFloor', () => {
    expect(getVerticalDirection(0, 1)).toBe('Go Upstairs');
    expect(getVerticalDirection(1, 2)).toBe('Go Upstairs');
  });

  it('returns Go Downstairs when toFloor < fromFloor', () => {
    expect(getVerticalDirection(1, 0)).toBe('Go Downstairs');
    expect(getVerticalDirection(2, 1)).toBe('Go Downstairs');
  });

  it('returns null when same floor', () => {
    expect(getVerticalDirection(0, 0)).toBeNull();
    expect(getVerticalDirection(2, 2)).toBeNull();
  });

  it('returns null when floor is undefined', () => {
    expect(getVerticalDirection(undefined, 0)).toBeNull();
    expect(getVerticalDirection(0, undefined)).toBeNull();
    expect(getVerticalDirection(undefined, undefined)).toBeNull();
  });
});
