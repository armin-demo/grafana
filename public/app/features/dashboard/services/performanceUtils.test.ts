import { createPerformanceMark, createPerformanceMeasure, measureTimeSinceBoot } from './performanceUtils';

describe('performanceUtils User Timing cleanup', () => {
  let markSpy: jest.SpyInstance;
  let measureSpy: jest.SpyInstance;
  let clearMarksSpy: jest.SpyInstance;
  let clearMeasuresSpy: jest.SpyInstance;

  beforeEach(() => {
    markSpy = jest.spyOn(performance, 'mark').mockReturnValue({ duration: 0 } as PerformanceMark);
    measureSpy = jest.spyOn(performance, 'measure').mockReturnValue({ duration: 0 } as PerformanceMeasure);
    clearMarksSpy = jest.spyOn(performance, 'clearMarks').mockImplementation(() => {});
    clearMeasuresSpy = jest.spyOn(performance, 'clearMeasures').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createPerformanceMeasure', () => {
    it('clears the measure and both bounding marks by name after measuring', () => {
      createPerformanceMeasure('measure-name', 'start-mark', 'end-mark');

      expect(measureSpy).toHaveBeenCalledWith('measure-name', 'start-mark', 'end-mark');
      expect(clearMeasuresSpy).toHaveBeenCalledWith('measure-name');
      expect(clearMarksSpy).toHaveBeenCalledWith('start-mark');
      expect(clearMarksSpy).toHaveBeenCalledWith('end-mark');
    });

    it('clears only the start mark when no end mark is provided', () => {
      createPerformanceMeasure('measure-name', 'start-mark');

      expect(measureSpy).toHaveBeenCalledWith('measure-name', 'start-mark');
      expect(clearMeasuresSpy).toHaveBeenCalledWith('measure-name');
      expect(clearMarksSpy).toHaveBeenCalledWith('start-mark');
      expect(clearMarksSpy).not.toHaveBeenCalledWith('end-mark');
    });

    it('still clears the bounding marks even when measuring throws', () => {
      measureSpy.mockImplementation(() => {
        throw new Error('missing mark');
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      createPerformanceMeasure('measure-name', 'start-mark', 'end-mark');

      expect(clearMarksSpy).toHaveBeenCalledWith('start-mark');
      expect(clearMarksSpy).toHaveBeenCalledWith('end-mark');
    });

    it('never clears entries globally (all clears are by name)', () => {
      createPerformanceMeasure('measure-name', 'start-mark', 'end-mark');

      for (const call of clearMarksSpy.mock.calls) {
        expect(call[0]).toBeDefined();
      }
      for (const call of clearMeasuresSpy.mock.calls) {
        expect(call[0]).toBeDefined();
      }
    });
  });

  describe('measureTimeSinceBoot', () => {
    it('returns the measured duration and clears the transient measure', () => {
      measureSpy.mockReturnValue({ duration: 42 } as PerformanceMeasure);

      const duration = measureTimeSinceBoot();

      expect(duration).toBe(42);
      expect(measureSpy).toHaveBeenCalledWith('time_since_boot', 'frontend_boot_js_done_time_seconds');
      expect(clearMeasuresSpy).toHaveBeenCalledWith('time_since_boot');
    });

    it('returns 0 when the boot mark is unavailable', () => {
      measureSpy.mockImplementation(() => {
        throw new Error('boot mark not found');
      });

      expect(measureTimeSinceBoot()).toBe(0);
    });
  });

  describe('createPerformanceMark', () => {
    it('creates the mark without clearing it (marks are cleared when measured)', () => {
      createPerformanceMark('a-mark', 123);

      expect(markSpy).toHaveBeenCalledWith('a-mark', { startTime: 123 });
      expect(clearMarksSpy).not.toHaveBeenCalled();
    });
  });
});
