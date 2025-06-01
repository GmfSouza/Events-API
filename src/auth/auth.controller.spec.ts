import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockUser = {
    email: 'test@example.com',
    password: 'password123!',
    role: 'ADMIN',
  };

  const mockAuthService = {
    login: jest.fn(),
    validateTokenEmail: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService
        }
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return access token when login is successful', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123'
      };
      const mockRequest = {
        user: mockUser
      } as any;
      const expectedResponse = { access_token: 'mock-token' };
      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(mockRequest, loginDto);

      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(expectedResponse);
    });
  })
});
