import { LocalAuthGuard } from './local-auth.guard';
import { Logger } from '@nestjs/common';

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    guard = new LocalAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should log initialization', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    new LocalAuthGuard();
    expect(logSpy).toHaveBeenCalledWith('LocalAuthGuard initialized');
  });

  it('should call super.canActivate', () => {
    const context: any = {};
    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(guard), 'canActivate')
      .mockReturnValue(true);

    const result = guard.canActivate(context);
    expect(superCanActivate).toHaveBeenCalledWith(context);
    expect(result).toBe(true);
  });
});