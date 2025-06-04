import { JwtAuthGuard } from './jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, Logger } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new JwtAuthGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true if route is public', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any as ExecutionContext;

    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});

    const result = guard.canActivate(context);
    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalledWith('Public route accessed');
  });

  it('should call super.canActivate if route is private', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any as ExecutionContext;

    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});

    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(guard), 'canActivate')
      .mockImplementation(function (this: any, ctx) {
        Logger.prototype.log('Private route accessed');
        return true;
      });

    const result = guard.canActivate(context);
    expect(superCanActivate).toHaveBeenCalledWith(context);
    expect(result).toBe(true);
    expect(Logger.prototype.log).toHaveBeenLastCalledWith(
      'Private route accessed',
    );
  });

  it('should log initialization', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    new JwtAuthGuard(reflector);
    expect(logSpy).toHaveBeenCalledWith('JwtAuthGuard initialized');
  });
});
