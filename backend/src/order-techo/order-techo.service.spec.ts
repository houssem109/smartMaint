import { OrderRuleEngineService } from './order-rule-engine.service';
import { OrderDataService } from './order-data.service';
import { OrderTechoService } from './order-techo.service';
import { AiService } from '../ai/ai.service';
import { ReferenceDataLoadLogService } from './reference-data-load-log.service';

function mockLoadLog(): ReferenceDataLoadLogService {
  return {
    logSuccess: jest.fn().mockResolvedValue(undefined),
    logFailure: jest.fn().mockResolvedValue(undefined),
  } as unknown as ReferenceDataLoadLogService;
}

describe('Order Techo (integration with CSV)', () => {
  let data: OrderDataService;
  let rules: OrderRuleEngineService;

  beforeAll(() => {
    process.env.ORDER_TECHO_ENABLED = 'true';
    data = new OrderDataService(mockLoadLog());
    data.onModuleInit();
    rules = new OrderRuleEngineService(data);
  });

  it('loads CSV files', () => {
    expect(data.isReady()).toBe(true);
  });

  it('uses error_type column for 25108223 (PROBLEME_DATE_CMD)', () => {
    const dp = data.findDataPlus('25108223');
    expect(dp).toBeTruthy();
    expect(dp!.errorType).toBe('PROBLEME_DATE_CMD');
    const r = rules.evaluate(dp!);
    expect(r?.code).toBe('PROBLEME_DATE_CMD');
  });

  it('uses error_type column for 25498266 (ITEM_BRANCH_RECORDS)', () => {
    const dp = data.findDataPlus('25498266');
    expect(dp).toBeTruthy();
    const r = rules.evaluate(dp!);
    expect(r?.code).toBe('ITEM_BRANCH_RECORDS');
  });
});

describe('Order Techo follow-up', () => {
  let orderTecho: OrderTechoService;

  beforeAll(() => {
    const data = new OrderDataService(mockLoadLog());
    data.onModuleInit();
    orderTecho = new OrderTechoService(data, new OrderRuleEngineService(data), {
      chat: async () => 'should not be called',
    } as unknown as AiService);
  });

  it('handles commande problem report for 25109760', async () => {
    const userId = 'test-user-commande-25109760';
    const res = await orderTecho.handleMessage(userId, 'i have commande 25109760 dont work');
    expect(res).not.toBeNull();
    expect(res?.orderNumber).toBe('25109760');
    expect(['order_data', 'order_facts']).toContain(res?.mode);
    expect(res?.reply).toMatch(/25109760|PROBLEME_DATE_CMD|CS/i);
  });

  it('answers dcto from CSV without RAG when order is in history', async () => {
    const userId = 'test-user-followup';
    const history = [
      { role: 'user' as const, content: 'why is order 25108223 blocked?' },
      {
        role: 'assistant' as const,
        content: 'Order blocked due to posting/date issue.',
      },
    ];
    const res = await orderTecho.handleMessage(userId, 'what is her type, CS or CA?', history);
    expect(res?.mode).toBe('order_facts');
    expect(res?.reply).toMatch(/CS/i);
    expect(res?.reply).not.toMatch(/thermocouple|manual/i);
  });
});
