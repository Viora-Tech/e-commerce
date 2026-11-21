import { describe, expect, it } from 'vitest'
import { renderEmail, sampleTemplateDataByTemplate } from '../src'
import { reportWords } from '../src/templates/content-reports'

const weekly = sampleTemplateDataByTemplate.staff_weekly_report
const monthly = sampleTemplateDataByTemplate.staff_monthly_report

describe('performance report emails', () => {
  it('the weekly report has every block of the agreed frame', async () => {
    const e = await renderEmail('staff_weekly_report', weekly)
    expect(e.subject).toBe('Waimers weekly report: ₹1,84,320 ▲ 18%')
    for (const part of [
      'Weekly report · Week 46',
      'Your week at Waimers.',
      'Monday 10 – Sunday 16 November',
      '₹1,84,320',
      'Saturday was your best day',
      'Repeat buyers',
      'Your last five weeks',
      'Open your analytics',
      'Your top sellers',
      reportWords.sources,
      'Worth a look this week',
      '🛒',
      'Send a reminder',
      'Money this week',
      reportWords.netSales,
      reportWords.analytics,
      reportWords.settings,
      'Sent every Monday at 9:00',
      reportWords.figuresNote,
    ]) {
      expect(e.html).toContain(part)
    }
  })

  it('the monthly report carries its own month, figures and to-dos', async () => {
    const e = await renderEmail('staff_monthly_report', monthly)
    expect(e.subject).toBe('Waimers monthly report: ₹6,42,800 ▲ 9%')
    for (const part of [
      'October 2026',
      '1–5 Oct',
      '15,880',
      'Your last six months',
      '₹1,45,600',
      'See returns',
    ]) {
      expect(e.html).toContain(part)
    }
    expect(e.html).not.toContain('Send a reminder')
  })

  it('the plain-text part reads on its own', async () => {
    const e = await renderEmail('staff_weekly_report', weekly)
    expect(e.text).toContain('Your week at Waimers.')
    expect(e.text).toContain('net sales ₹1,84,320 (▲ 18% vs ₹1,56,220 last week')
    expect(e.text).toContain('1. Wireless mouse, 31 sold, ₹40,300')
    expect(e.text).toContain('Instagram 62%')
    expect(e.text).toContain('Net sales: ₹1,84,320')
    expect(e.text).toContain('Open your analytics: https://')
    expect(e.text).not.toMatch(/\n\n\n/)
  })

  it('without a dark logo or any logo, the band is black and shows the store name', async () => {
    const e = await renderEmail('staff_weekly_report', { ...weekly, brand: undefined })
    expect(e.html).toContain('#141414')
    const light = await renderEmail('staff_weekly_report', {
      ...weekly,
      brand: { logoUrl: 'https://cdn.example.com/logo.png' },
    })
    expect(light.html).toContain('#f6f5f2')
    expect(light.html).toContain('https://cdn.example.com/logo.png')
  })

  it('empty to-dos and sources hide their blocks', async () => {
    const report = weekly.report && { ...weekly.report, todos: [], sources: [] }
    const e = await renderEmail('staff_weekly_report', { ...weekly, report })
    expect(e.html).not.toContain('Worth a look this week')
    expect(e.html).not.toContain(reportWords.sources)
  })

  it('the daily summary uses the report layout with its to-dos first', async () => {
    const e = await renderEmail(
      'staff_daily_summary',
      sampleTemplateDataByTemplate.staff_daily_summary,
    )
    expect(e.html.indexOf('Waiting on you today')).toBeLessThan(
      e.html.indexOf('Sold most yesterday'),
    )
  })
})
