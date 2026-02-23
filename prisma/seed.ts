import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Create services
  const services = [
    {
      name: 'Strategy Session',
      description: 'A 60-minute deep dive into your business strategy.',
      duration: 60,
      price: 150,
    },
    {
      name: 'Technical Audit',
      description: 'Full audit of your software architecture and code.',
      duration: 90,
      price: 250,
    },
    {
      name: 'Quick Consultation',
      description: '30-minute call for quick questions.',
      duration: 30,
      price: 75,
    },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: {
        id: s.name.toLowerCase().replace(/\s+/g, '-'),
        ...s
      },
    });
  }

  // Create availability (Mon-Fri, 9-5)
  for (let i = 1; i <= 5; i++) {
    await prisma.availability.create({
      data: {
        dayOfWeek: i,
        startTime: '09:00',
        endTime: '17:00',
      },
    });
  }

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
