import { Form, InputNumber, Select, Switch } from 'antd'

export function SourceScheduleFields(): React.JSX.Element {
  return (
    <>
      <Form.Item
        name={['schedule', 'enabled']}
        label="定时同步"
        valuePropName="checked"
        initialValue={false}
      >
        <Switch />
      </Form.Item>
      <Form.Item
        noStyle
        shouldUpdate={(prev, cur) => prev.schedule?.enabled !== cur.schedule?.enabled}
      >
        {({ getFieldValue }) =>
          getFieldValue(['schedule', 'enabled']) ? (
            <div className="grid grid-cols-2 gap-3">
              <Form.Item
                name={['schedule', 'interval']}
                label="同步间隔"
                initialValue={1}
                rules={[{ required: true, type: 'number', min: 1 }]}
              >
                <InputNumber min={1} className="w-full" />
              </Form.Item>
              <Form.Item
                name={['schedule', 'unit']}
                label="单位"
                initialValue="day"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { value: 'hour', label: '小时' },
                    { value: 'day', label: '天' },
                    { value: 'week', label: '周' },
                    { value: 'month', label: '月' }
                  ]}
                />
              </Form.Item>
            </div>
          ) : null
        }
      </Form.Item>
    </>
  )
}
