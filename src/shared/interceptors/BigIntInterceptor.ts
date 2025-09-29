import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type ResponseBody<T> = Record<keyof T, T[keyof T] | string>;

@Injectable()
export class BigIntInterceptor<T = null> implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<string> {
    if (context.getType() === 'http') {
      const response = context.switchToHttp().getResponse();
      response.type('JSON');
    }
    return next.handle().pipe(map((value) => this.transform(value)));
  }

  transform(obj?: ResponseBody<T>): string {
    return JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
  }
}
