import { prisma } from './prisma'

export async function seedChipPackages() {
  const packages = [
    {
      name: "Basic Pack",
      description: "Get started with video analysis",
      chipAmount: 70,
      priceUsd: 100, // $1.00 (1.43 cents per chip)
      stripePriceId: "price_1RtF5JRuZqCNb5e3Esfx4qwr", // Basic Pack price ID
      sortOrder: 1
    },
    {
      name: "Value Pack",
      description: "Better value for regular users",
      chipAmount: 200,
      priceUsd: 250, // $2.50 (1.25 cents per chip)
      stripePriceId: "price_1RtF67RuZqCNb5e3g7gQfuNH", // Value Pack price ID
      sortOrder: 2
    }
  ]

  console.log('Seeding chip packages...')

  for (const packageData of packages) {
    const existingPackage = await prisma.chipPackage.findFirst({
      where: { name: packageData.name }
    })

    if (!existingPackage) {
      await prisma.chipPackage.create({
        data: packageData
      })
      console.log(`Created package: ${packageData.name}`)
    } else {
      console.log(`Package already exists: ${packageData.name}`)
    }
  }

  console.log('Chip packages seeded successfully!')
}

// Run this if called directly
if (require.main === module) {
  seedChipPackages()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error seeding chip packages:', error)
      process.exit(1)
    })
}