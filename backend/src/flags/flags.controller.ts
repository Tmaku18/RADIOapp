import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { FlagsService } from './flags.service';

class SetFlagDto {
  @IsString()
  @IsIn(['crossfadeMs', 'weeklyDigest', 'degradedPlayback'])
  name: string;

  @IsString()
  value: string;
}

@Controller('flags')
export class FlagsController {
  constructor(private readonly flags: FlagsService) {}

  @Public()
  @Get()
  list() {
    return this.flags.all();
  }

  @Put()
  @Roles('admin')
  update(@Body() body: SetFlagDto) {
    return this.flags.set(body.name, body.value);
  }
}
