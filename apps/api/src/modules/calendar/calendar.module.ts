import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController, PublicCalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarEvent } from './entities/calendar-event.entity';
import { CalendarShare } from './entities/calendar-share.entity';

/** Kalendář firmy + veřejné sdílení odkazem (iCal feed). */
@Module({
  imports: [TypeOrmModule.forFeature([CalendarEvent, CalendarShare])],
  controllers: [CalendarController, PublicCalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
