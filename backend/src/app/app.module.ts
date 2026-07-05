import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConnectionEntity } from '../connections/connection.entity';
import { ConnectionsModule } from '../connections/connections.module';
import { ServerModule } from '../server/service.module';
import { TerminalModule } from '../terminal/terminal.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [ConnectionEntity],
        synchronize: true, // auto-creates table; set false after first run in production
        ssl:
          config.get('DATABASE_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    AuthModule,
    ConnectionsModule,
    ServerModule,
    TerminalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
