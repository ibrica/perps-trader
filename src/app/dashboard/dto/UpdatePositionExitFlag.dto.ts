import { IsBoolean } from 'class-validator';

export class UpdatePositionExitFlagDto {
  @IsBoolean({ message: 'exitFlag must be a boolean value' })
  exitFlag: boolean;
}
