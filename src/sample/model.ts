import { MinerModel } from '../core/model.ts';

/** 独立的手感对照；默认路径和六关正式规则保持一致。0.7是试验值，不是原版常量。 */
export class SampleModel extends MinerModel {
  private slowLarge: boolean;
  constructor(slowLarge = false) { super(); this.slowLarge = slowLarge; }
  override get returnSpeed() {
    return super.returnSpeed * (this.slowLarge && this.carried?.kind === 'large' ? .7 : 1);
  }
}
