import { IsBoolean } from 'class-validator';

export class UpdateSettingsDto {
  @IsBoolean({ message: 'closeAllPositions must be a boolean value' })
  closeAllPositions: boolean;
}
