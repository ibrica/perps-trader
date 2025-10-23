import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

export class UpdateSettingsDto {
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new BadRequestException(
      'closeAllPositions must be a boolean value',
    );
  })
  @IsBoolean({ message: 'closeAllPositions must be a boolean value' })
  closeAllPositions: boolean;
}
