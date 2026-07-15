import { describe, expect, it } from 'vitest';
import { projectDeliveryMetrics } from './delivery-summary';

describe('projectDeliveryMetrics', () => {
  it('never reports negative or more completed checks than required', () => {
    expect(
      projectDeliveryMetrics({
        status: 'failed',
        report_count: 1,
        required_check_count: 1,
        pending_required_check_count: 3,
        failed_check_count: 2,
        residual_risk_count: -1,
      })
    ).toEqual({ passed: 0, pending: 0, failed: 1, risks: 0, required: 1 });
  });

  it('projects ordinary verification evidence without changing its total', () => {
    expect(
      projectDeliveryMetrics({
        status: 'needs_review',
        report_count: 2,
        required_check_count: 5,
        pending_required_check_count: 1,
        failed_check_count: 1,
        residual_risk_count: 2,
      })
    ).toEqual({ passed: 3, pending: 1, failed: 1, risks: 2, required: 5 });
  });
});
