import { HttpException, HttpStatus } from '@nestjs/common';

export class ItemExistsException extends HttpException {
  constructor() {
    super('Item already exists!', HttpStatus.BAD_REQUEST);
  }
}
