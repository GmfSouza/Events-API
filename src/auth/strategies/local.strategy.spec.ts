import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { Logger, UnauthorizedException } from '@nestjs/common';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    authService = {
      validateUser: jest.fn(),
    };
    strategy = new LocalStrategy(authService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should log initialization', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    new LocalStrategy(authService);
    expect(logSpy).toHaveBeenCalledWith('LocalStrategy initialized');
  });

  it('should validate and return user if credentials are valid', async () => {
    const user = { id: '1', email: 'test@test.com' };
    authService.validateUser.mockResolvedValueOnce(user);
    const result = await strategy.validate('test@test.com', 'password');
    expect(authService.validateUser).toHaveBeenCalledWith('test@test.com', 'password');
    expect(result).toBe(user);
    expect(Logger.prototype.log).toHaveBeenCalledWith('Validating user with email test@test.com');
  });

  it('should throw UnauthorizedException if credentials are invalid', async () => {
    authService.validateUser.mockResolvedValueOnce(null);
    await expect(strategy.validate('test@test.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    expect(Logger.prototype.log).toHaveBeenCalledWith('Validating user with email test@test.com');
  });
});