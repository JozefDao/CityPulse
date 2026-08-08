import { PrismaClient, ArticleStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function upsertUser(
  email: string,
  nickname: string,
  password: string,
  role: Role,
  updatePassword = false,
) {
  const passwordHash = await bcrypt.hash(password, 10);

  const updateData: { role: Role; nickname: string; passwordHash?: string } = {
    role,
    nickname,
  };
  if (updatePassword) {
    updateData.passwordHash = passwordHash;
  }

  return prisma.user.upsert({
    where: { email },
    update: updateData,
    create: {
      email,
      nickname,
      passwordHash,
      role,
    },
  });
}

async function main() {
  const adminEmail = 'admin@citypulse.dev';
  const adminNickname = 'admin_citypulse';
  const demoAdminPassword = 'admin12345!';
  const isProduction = process.env.NODE_ENV?.trim().toLowerCase() === 'production';
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();

  if (isProduction && !adminPassword) {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      throw new Error(
        'ADMIN_PASSWORD is required when running seed in production without an existing admin.',
      );
    }
  }

  const admin = await upsertUser(
    adminEmail,
    adminNickname,
    adminPassword ?? demoAdminPassword,
    Role.ADMIN,
    Boolean(adminPassword),
  );

  if (!isProduction) {
    console.log(
      'Seeding local/demo admin account with known development credentials. Do not use this password in production.',
    );
  }

  const cities = [
    { name: 'Bratislava', countryCode: 'SK', lat: 48.1486, lon: 17.1077, timezone: 'Europe/Bratislava' },
    { name: 'Prague', countryCode: 'CZ', lat: 50.0755, lon: 14.4378, timezone: 'Europe/Prague' },
    { name: 'Vienna', countryCode: 'AT', lat: 48.2082, lon: 16.3738, timezone: 'Europe/Vienna' },
    { name: 'Malaga', countryCode: 'ES', lat: 36.7213, lon: -4.4214, timezone: 'Europe/Madrid' },
    { name: 'Krakow', countryCode: 'PL', lat: 50.0647, lon: 19.945, timezone: 'Europe/Warsaw' },
  ];

  for (const city of cities) {
    const existing = await prisma.city.findFirst({
      where: { name: city.name, lat: city.lat, lon: city.lon },
    });
    if (!existing) {
      await prisma.city.create({ data: city });
    }
  }

  const articles = [
    {
      authorId: admin.id,
      title: 'Bratislava riverfront run: best weekday windows this month',
      slug: 'bratislava-riverfront-run-best-weekday-windows',
      summary: 'A practical routine for planning evening runs near the Danube with wind and rain in mind.',
      markdown: `# Bratislava riverfront run: best weekday windows this month

If you run along the Danube promenade, the two values that usually matter most are **wind direction** and short-term rain risk. Temperature matters too, but a comfortable temperature does not help much if gusts keep breaking your pace.

## What to compare before you leave

- Look at the **18:00-20:00** window and compare it with the hours before and after it
- Check gusts, not only average wind speed
- Treat short rain bursts seriously, especially if you plan intervals or longer loops
- Check PM2.5 if you expect hard effort near traffic

## Simple pre-run routine

- [ ] Check hourly wind speed and gusts
- [ ] Check precipitation for the next 2 hours
- [ ] Check air quality before a hard session

## Route note

If the riverfront looks too exposed, switch to loops around Eurovea and nearby old-town blocks. Buildings reduce gust exposure and make pacing more predictable.
`,
    },
    {
      authorId: admin.id,
      title: 'Prague Old Town weekend walk: when to avoid rain crowds',
      slug: 'prague-old-town-weekend-walk-rain-crowds',
      summary: 'How to choose dry and less crowded windows for a city-center walk near Charles Bridge.',
      markdown: `# Prague Old Town weekend walk: when to avoid rain crowds

Rain probability alone is not enough when you plan a city walk. For comfort in the Old Town, combine three signals:

1. Expected rain amount (mm)
2. Wind speed in exposed streets and bridges
3. Temperature trend from late morning into the afternoon

## How to read the forecast

A practical approach is to compare **late morning to early afternoon** with the period after 16:00. The point is not to predict crowd levels perfectly, but to find the driest and most comfortable time window for walking.

## Practical plan

- Start around 10:30 if the forecast is stable
- Keep one indoor backup stop every 20-30 minutes
- If wind rises above 20 km/h, move from the river route to narrower streets

This usually gives you a more comfortable route even when the forecast is mixed.
`,
    },
    {
      authorId: admin.id,
      title: 'Vienna outdoor concert planning with weather and AQ',
      slug: 'vienna-outdoor-concert-planning-weather-aq',
      summary: 'A simple framework for event organizers: comfort, safety, and communication thresholds.',
      markdown: `# Vienna outdoor concert planning with weather and AQ

Outdoor events work better when the weather thresholds are agreed in advance. If the whole team knows what counts as a safe, risky, or cancellation-level condition, communication becomes much simpler.

## Suggested thresholds

| Metric | Green | Amber | Red |
|---|---:|---:|---:|
| Wind max | < 20 km/h | 20-35 km/h | > 35 km/h |
| Rain sum | < 1 mm | 1-4 mm | > 4 mm |
| PM2.5 | < 15 ug/m3 | 15-35 ug/m3 | > 35 ug/m3 |

## Communication timeline

- **T-24h**: first attendee advisory
- **T-6h**: operational update for vendors and staff
- **T-2h**: final go/no-go notice

A simple threshold table like this prevents last-minute confusion for both organizers and visitors.
`,
    },
    {
      authorId: admin.id,
      title: 'Malaga beach morning: picking the calmest hours',
      slug: 'malaga-beach-morning-calmest-hours',
      summary: 'Morning sea breeze can change quickly. Here is a practical way to choose stable hours.',
      markdown: `# Malaga beach morning: picking the calmest hours

If you are planning a beach walk, an easy swim, or a light morning workout, the most useful thing to watch is the **wind trend between 07:00 and 11:00**. Conditions can still look fine at sunrise and become much less comfortable a few hours later.

## What to watch

- If wind rises steadily for several hours, the shoreline usually feels rougher by late morning
- High humidity can make moderate temperatures feel heavier than expected
- Early hours are often the easiest time to avoid stronger sea breeze and busier beach traffic

## Recommendation

A practical starting window is **08:00-10:30** if you want a calmer beach walk, easier swimming conditions, or a lighter outdoor workout. Before leaving, check whether wind and humidity are still moving in the right direction.
`,
    },
    {
      authorId: admin.id,
      title: 'Krakow evening bike commute: forecast signals that matter',
      slug: 'krakow-evening-bike-commute-forecast-signals',
      summary: 'A commuter guide to combine hourly weather and PM2.5 before heading home.',
      markdown: `# Krakow evening bike commute: forecast signals that matter

An evening bike commute is usually decided by three things: gusty wind, short rain bursts, and air quality after peak traffic. Looking at only one of them often gives you the wrong answer.

## Commute decision flow

1. Check the next 90 minutes of rain
2. Check gusts, not just average wind speed
3. Compare PM2.5 now with the next visible forecast window

If two of these signals worsen at the same time, public transport is usually the safer and more comfortable choice for that trip.
`,
    },
  ];

  for (const article of articles) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: {
        authorId: article.authorId,
        title: article.title,
        summary: article.summary,
        markdown: article.markdown,
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      create: {
        ...article,
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

