import { IsOptional, IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateCurrencyDto {
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  mintAddress: string;

  @IsString()
  @IsNotEmpty()
  blockchain: string;

  @IsNumber()
  @IsNotEmpty()
  decimals: number;

  @IsString()
  @IsOptional()
  symbolPrefix?: string;

  @IsNumber()
  @IsOptional()
  coinMarketCapId?: number;
}
