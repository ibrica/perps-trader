import { IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';

export class UpdatePerpDto {
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Recommended amount must be at least 0' })
  recommendedAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Default leverage must be at least 1' })
  @Max(100, { message: 'Default leverage cannot exceed 100' })
  defaultLeverage?: number;

  @IsOptional()
  @IsBoolean()
  buyFlag?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
