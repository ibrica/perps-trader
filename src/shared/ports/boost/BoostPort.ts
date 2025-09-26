import { Injectable } from '@nestjs/common';
import { PriorityRouter } from '../../models';
import { PriorityRouterPort } from '../priority-router';

@Injectable()
export abstract class BoostPort extends PriorityRouterPort {
  router = PriorityRouter.BOOST;
}
