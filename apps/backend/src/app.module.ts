import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateAppConfig } from './config/app-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CitiesModule } from './cities/cities.module';
import { MeModule } from './me/me.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { WeatherModule } from './weather/weather.module';
import { ArticlesModule } from './articles/articles.module';
import { UsersModule } from './users/users.module';
import { SupportModule } from './support/support.module';
import { AlertsModule } from './alerts/alerts.module';
import { ThrottlerGuard } from './common/guards/throttler.guard';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateAppConfig,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    CitiesModule,
    MeModule,
    WatchlistModule,
    WeatherModule,
    ArticlesModule,
    UsersModule,
    SupportModule,
    AlertsModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
