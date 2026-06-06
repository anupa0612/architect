const bcrypt = require('bcryptjs');
const db = require('./db');

const architectsSeed = [
  {
    name: 'Nadia Carvalho', email: 'nadia@archhire.test', studio: 'Studio Carvalho',
    title: 'Principal Architect', specialty: 'Residential', badge: 'Top Rated',
    experience: '14 yrs', projects: 42, rating: 4.9, location: 'Lisbon, PT', price: 'From $12,000',
    tags: ['Luxury Residential', 'Sustainable', 'Mediterranean'],
    img: 'https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=500&q=80',
    bio: 'Award-winning architect specialising in luxury villas and coastal residences that blend organic materials with clean contemporary forms.',
    packages: [
      { name: 'Concept Design', price: '$8,000', featured: false, features: ['Site analysis', '3 concepts', '2D plans', '3D renders', '2 revisions'] },
      { name: 'Full Design', price: '$22,000', featured: true, features: ['All Concept items', 'Working drawings', 'Permits', 'Contractor docs', 'Unlimited revisions', 'Site visits'] }
    ]
  },
  {
    name: 'Kenji Mori', email: 'kenji@archhire.test', studio: 'Mori Atelier',
    title: 'Urban Architect', specialty: 'Commercial', badge: 'Rising Star',
    experience: '9 yrs', projects: 28, rating: 4.8, location: 'Tokyo, JP', price: 'From $15,000',
    tags: ['Commercial', 'Mixed-Use', 'Minimalist'],
    img: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=500&q=80',
    bio: 'Tokyo-based architect with a minimalist philosophy. Known for clean commercial spaces that maximise light and human flow.',
    packages: [
      { name: 'Spatial Concept', price: '$15,000', featured: false, features: ['Brief analysis', 'Concept layouts', 'Material palette', '3D walkthrough'] },
      { name: 'Complete Package', price: '$38,000', featured: true, features: ['All Concept items', 'Technical drawings', 'MEP coordination', 'Construction oversight'] }
    ]
  },
  {
    name: 'Amara Osei', email: 'amara@archhire.test', studio: 'Osei Landscapes',
    title: 'Landscape Architect', specialty: 'Landscape', badge: 'Verified',
    experience: '11 yrs', projects: 56, rating: 4.9, location: 'Accra, GH', price: 'From $6,500',
    tags: ['Landscape', 'Biophilic', 'Public Space'],
    img: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=500&q=80',
    bio: 'A visionary landscape architect connecting ecology, culture and community through bold green infrastructure.',
    packages: [
      { name: 'Landscape Concept', price: '$6,500', featured: false, features: ['Site ecology study', '3 design schemes', 'Planting plans', 'Visual renders'] },
      { name: 'Full Landscape', price: '$18,000', featured: true, features: ['All Concept items', 'Construction documents', 'Contractor liaison', 'Plant procurement'] }
    ]
  },
  {
    name: 'Elena Vasquez', email: 'elena@archhire.test', studio: 'Vasquez Interiors',
    title: 'Interior Architect', specialty: 'Interior', badge: 'Top Rated',
    experience: '12 yrs', projects: 63, rating: 5.0, location: 'Barcelona, ES', price: 'From $5,000',
    tags: ['Interior Design', 'Hospitality', 'Art Deco'],
    img: 'https://images.unsplash.com/photo-1615529179035-e760f6a2dcee?w=500&q=80',
    bio: 'Barcelona-based interior architect transforming spaces through rich materiality, layered light and timeless elegance.',
    packages: [
      { name: 'Interior Concept', price: '$5,000', featured: false, features: ['Space planning', 'Mood boards', 'Material selection', '3D renders'] },
      { name: 'Full Interior', price: '$16,000', featured: true, features: ['All Concept items', 'FF&E specification', 'Supplier coordination', 'Installation oversight'] }
    ]
  },
  {
    name: 'Raj Mehta', email: 'raj@archhire.test', studio: 'Mehta Sustainable',
    title: 'Sustainable Architect', specialty: 'Sustainable', badge: 'Verified',
    experience: '16 yrs', projects: 34, rating: 4.8, location: 'Mumbai, IN', price: 'From $10,000',
    tags: ['Sustainable', 'Passive Design', 'Green Cert.'],
    img: 'https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?w=500&q=80',
    bio: 'Pioneer in bioclimatic design and passive cooling systems for tropical climates. LEED Platinum accredited.',
    packages: [
      { name: 'Sustainability Audit', price: '$4,500', featured: false, features: ['Site solar study', 'Wind analysis', 'Passive design strategy', 'Energy model'] },
      { name: 'Full Eco Design', price: '$28,000', featured: true, features: ['All Audit items', 'Full architectural drawings', 'Green cert support', 'Post-occupancy review'] }
    ]
  },
  {
    name: 'Sophie Laurent', email: 'sophie@archhire.test', studio: 'Atelier Laurent',
    title: 'Heritage Architect', specialty: 'Residential', badge: 'Featured',
    experience: '18 yrs', projects: 29, rating: 4.9, location: 'Paris, FR', price: 'From $18,000',
    tags: ['Heritage', 'Renovation', 'French Classicism'],
    img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=500&q=80',
    bio: 'Renowned for her sensitive approach to heritage conservation and adaptive reuse of historic buildings in France and across Europe.',
    packages: [
      { name: 'Heritage Assessment', price: '$7,500', featured: false, features: ['Historical research', 'Conservation report', 'Scope of works', 'Planning advice'] },
      { name: 'Adaptive Reuse', price: '$35,000', featured: true, features: ['All Assessment items', 'Full design', 'Planning application', 'Site management', 'Handover'] }
    ]
  }
];

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) {
    console.log('Database already seeded (' + count + ' users). Skipping.');
    return;
  }

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const insertUser = db.prepare(
    `INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, 'active')`
  );
  const insertProfile = db.prepare(
    `INSERT INTO architect_profiles
      (user_id, studio, title, specialty, location, experience, bio, rating, projects, price, badge, img, tags, packages)
     VALUES (@user_id,@studio,@title,@specialty,@location,@experience,@bio,@rating,@projects,@price,@badge,@img,@tags,@packages)`
  );
  const insertProject = db.prepare(
    `INSERT INTO projects (customer_id, title, type, location, description, size, timeline, budget, style, status)
     VALUES (@customer_id,@title,@type,@location,@description,@size,@timeline,@budget,@style,@status)`
  );

  const tx = db.transaction(() => {
    // Admin
    insertUser.run('Platform Admin', 'admin@archhire.test', hash('admin123'), 'admin');

    // Architects
    for (const a of architectsSeed) {
      const info = insertUser.run(a.name, a.email, hash('arch123'), 'architect');
      insertProfile.run({
        user_id: info.lastInsertRowid,
        studio: a.studio, title: a.title, specialty: a.specialty, location: a.location,
        experience: a.experience, bio: a.bio, rating: a.rating, projects: a.projects,
        price: a.price, badge: a.badge, img: a.img,
        tags: JSON.stringify(a.tags), packages: JSON.stringify(a.packages)
      });
    }

    // Customer
    const cust = insertUser.run('James Client', 'customer@archhire.test', hash('cust123'), 'customer');

    // Sample projects for the customer
    const sampleProjects = [
      { title: 'Coastal Villa — Galle, Sri Lanka', type: 'Residential', location: 'Galle, Sri Lanka', description: 'A modern coastal villa with open-plan living and sea views.', size: '400 sqm', timeline: '12 months', budget: '$280,000', style: 'Contemporary, Biophilic', status: 'open' },
      { title: 'Lakeside Retreat — Kandy', type: 'Interior', location: 'Kandy, Sri Lanka', description: 'Interior refresh for a lakeside retreat using natural materials.', size: '220 sqm', timeline: '8 months', budget: '$85,000', style: 'Organic, Natural Materials', status: 'open' }
    ];
    for (const p of sampleProjects) {
      insertProject.run({ customer_id: cust.lastInsertRowid, ...p });
    }

    db.prepare(`INSERT INTO activity_logs (user_id, role, action, detail) VALUES (NULL, 'system', 'seed', 'Initial database seed completed')`).run();
  });

  tx();
  console.log('Seeded database with demo accounts:');
  console.log('  Admin     -> admin@archhire.test / admin123');
  console.log('  Customer  -> customer@archhire.test / cust123');
  console.log('  Architect -> nadia@archhire.test / arch123  (and others, all arch123)');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
