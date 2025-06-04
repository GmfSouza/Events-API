import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CreateUserDto } from "src/users/dto/create-user.dto";
import { UserRole } from "src/users/enums/user-role.enum";
import { UsersService } from "src/users/users.service";

@Injectable()
export class SeedService {
    private readonly logger = new Logger(SeedService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
    ) {}

    async seedUser(): Promise<void> {
        const adminName = this.configService.get<string>('DEFAULT_ADMIN_NAME');
        const adminEmail = this.configService.get<string>('DEFAULT_ADMIN_EMAIL');
        const adminPassword = this.configService.get<string>('DEFAULT_ADMIN_PASSWORD');
        const adminPhone = this.configService.get<string>('DEFAULT_ADMIN_PHONE');

        if (!adminName || !adminEmail || !adminPassword || !adminPhone) {
            this.logger.warn('Default admin credentials are not set in the environment variables.');
            return;
        }

        const existingUser = await this.usersService.findUserByEmail(adminEmail);
        if (existingUser) {
            this.logger.warn(`User with email ${adminEmail} already exists.`);
            return;
        }

        try {
            const admin: CreateUserDto = {
                name: adminName,
                email: adminEmail,
                password: adminPassword,
                phone: adminPhone,
                role: UserRole.ADMIN,
            }

            const createdAdmin = await this.usersService.create(admin);
            this.logger.log(`User ${createdAdmin.name} created successfully.`);
        } catch (error) {
            this.logger.error('Error creating default admin user:', error.stack);
        }
    }
}