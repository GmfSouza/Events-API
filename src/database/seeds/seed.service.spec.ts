import { SeedService } from './seed.service';
import { Logger } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { UserRole } from 'src/users/enums/user-role.enum';

describe('SeedService', () => {
  let service: SeedService;
  let configService: any;
  let usersService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn(),
    };
    usersService = {
      findUserByEmail: jest.fn(),
      create: jest.fn(),
    };
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    service = new SeedService(configService, usersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should warn and return if admin env vars are missing', async () => {
    configService.get.mockReturnValueOnce(undefined);
    await service.seedUser();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      'Default admin credentials are not set in the environment variables.',
    );
  });

  it('should warn and return if user already exists', async () => {
    configService.get
      .mockReturnValueOnce('Admin')
      .mockReturnValueOnce('admin@email.com')
      .mockReturnValueOnce('pass')
      .mockReturnValueOnce('123');
    usersService.findUserByEmail.mockResolvedValueOnce({ id: '1' });
    await service.seedUser();
    expect(usersService.findUserByEmail).toHaveBeenCalledWith(
      'admin@email.com',
    );
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      'User with email admin@email.com already exists.',
    );
  });

  it('should create admin user if not exists', async () => {
    configService.get
      .mockReturnValueOnce('Admin')
      .mockReturnValueOnce('admin@email.com')
      .mockReturnValueOnce('pass')
      .mockReturnValueOnce('123');
    usersService.findUserByEmail.mockResolvedValueOnce(null);
    usersService.create.mockResolvedValueOnce({ name: 'Admin' });
    await service.seedUser();
    expect(usersService.create).toHaveBeenCalledWith({
      name: 'Admin',
      email: 'admin@email.com',
      password: 'pass',
      phone: '123',
      role: UserRole.ADMIN,
    });
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'User Admin created successfully.',
    );
  });

  it('should log error if user creation throws', async () => {
    configService.get
      .mockReturnValueOnce('Admin')
      .mockReturnValueOnce('admin@email.com')
      .mockReturnValueOnce('pass')
      .mockReturnValueOnce('123');
    usersService.findUserByEmail.mockResolvedValueOnce(null);
    usersService.create.mockRejectedValueOnce(new Error('fail'));
    await service.seedUser();
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
