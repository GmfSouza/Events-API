import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './enums/user-role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthenticatedRequest } from './interfaces/auth-request.interface';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: UserRole.PARTICIPANT,
    isActive: true,
  };

  const mockUsersService = {
    create: jest.fn(),
    findUserById: jest.fn(),
    findAllUsers: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockRequest = (user): AuthenticatedRequest => {
    return {
      user,
    } as unknown as AuthenticatedRequest;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createUser', () => {
    it('should create a user', async () => {
      const dto: CreateUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password!',
        phone: '1234567890',
        role: UserRole.PARTICIPANT,
      };

      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await controller.createUser(dto, undefined);

      expect(service.create).toHaveBeenCalledWith(dto, undefined);
      expect(result.email).toBe(dto.email);
    });
  });

  describe('getUser', () => {
    it('should return user if admin', async () => {
      mockUsersService.findUserById.mockResolvedValue(mockUser);

      const result = await controller.getUser('user-123', mockRequest({
        userId: 'admin-1',
        role: UserRole.ADMIN,
      }));

      expect(service.findUserById).toHaveBeenCalledWith('user-123');
      expect(result.id).toBe(mockUser.id);
    });

    it('should return user if self', async () => {
      mockUsersService.findUserById.mockResolvedValue(mockUser);

      const result = await controller.getUser('user-123', mockRequest({
        userId: 'user-123',
        role: UserRole.PARTICIPANT,
      }));

      expect(result.email).toBe(mockUser.email);
    });

    it('should throw ForbiddenException if unauthorized', async () => {
      await expect(
        controller.getUser('other-id', mockRequest({
          userId: 'user-123',
          role: UserRole.PARTICIPANT,
        })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUsersService.findUserById.mockResolvedValue(null);

      await expect(
        controller.getUser('non-existent-id', mockRequest({
          userId: 'non-existent-id',
          role: UserRole.ADMIN,
        })),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAll', () => {
    it('should return all users for admin', async () => {
      mockUsersService.findAllUsers.mockResolvedValue({
        users: [mockUser],
        total: 1,
        lastEvaluatedKey: undefined,
      });

      const result = await controller.getAll({}, mockRequest({
        userId: 'admin-1',
        role: UserRole.ADMIN,
      }));

      expect(result.total).toBe(1);
      expect(result.items.length).toBe(1);
    });

    it('should throw ForbiddenException for non-admin', async () => {
      await expect(
        controller.getAll({}, mockRequest({
          userId: 'user-123',
          role: UserRole.PARTICIPANT,
        })),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateUser', () => {
    it('should update the user if owner', async () => {
      const dto: UpdateUserDto = { name: 'Updated' };
      const updatedUser = { ...mockUser, name: 'Updated' };

      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.updateUser('user-123', dto, mockRequest({
        userId: 'user-123',
        role: UserRole.PARTICIPANT,
      }));

      expect(service.update).toHaveBeenCalledWith('user-123', dto);
      expect(result.name).toBe('Updated');
    });

    it('should throw ForbiddenException if not the owner', async () => {
      await expect(
        controller.updateUser('user-123', {}, mockRequest({
          userId: 'user-999',
          role: UserRole.PARTICIPANT,
        })),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should allow delete for admin', async () => {
      await controller.delete('user-123', mockRequest({
        userId: 'admin-1',
        role: UserRole.ADMIN,
      }));

      expect(service.softDelete).toHaveBeenCalledWith('user-123');
    });

    it('should allow delete for self', async () => {
      await controller.delete('user-123', mockRequest({
        userId: 'user-123',
        role: UserRole.PARTICIPANT,
      }));

      expect(service.softDelete).toHaveBeenCalledWith('user-123');
    });

    it('should throw ForbiddenException for other user', async () => {
      await expect(
        controller.delete('user-123', mockRequest({
          userId: 'other-user',
          role: UserRole.PARTICIPANT,
        })),
      ).rejects.toThrow(ForbiddenException);
    });
  });
})
