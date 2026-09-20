import { createContext, useContext, useMemo, useState } from 'react';

const AdminDataContext = createContext();
const initialCities = ['Pune', 'Mumbai', 'Nashik', 'Nagpur', 'Chh. Sambhajinagar'];
const doorTypes = ['Single Leaf Dead Lock', 'Single Leaf Panic Bar', 'Double Leaf Dead Lock', 'Double Leaf Panic Bar', 'Glass Door'];
const seedInstallers = [
  { id: 'i1', name: 'Rahul Patil', phone: '98765 41021', email: 'rahul@trackinstall.demo', city: 'Pune', status: 'ACTIVE', charges: { 'Single Leaf Dead Lock': 1200, 'Single Leaf Panic Bar': 1350, 'Double Leaf Dead Lock': 1800, 'Double Leaf Panic Bar': 2050, 'Glass Door': 2500, visit: 500 } },
  { id: 'i2', name: 'Amit Joshi', phone: '98765 41022', email: 'amit@trackinstall.demo', city: 'Pune', status: 'ACTIVE', charges: { 'Single Leaf Dead Lock': 1250, 'Single Leaf Panic Bar': 1400, 'Double Leaf Dead Lock': 1850, 'Double Leaf Panic Bar': 2100, 'Glass Door': 2550, visit: 500 } },
  { id: 'i3', name: 'Vikram Shah', phone: '98765 41023', email: 'vikram@trackinstall.demo', city: 'Mumbai', status: 'ACTIVE', charges: { 'Single Leaf Dead Lock': 1300, 'Single Leaf Panic Bar': 1450, 'Double Leaf Dead Lock': 1900, 'Double Leaf Panic Bar': 2150, 'Glass Door': 2600, visit: 550 } },
  { id: 'i4', name: 'Sanjay More', phone: '98765 41024', email: 'sanjay@trackinstall.demo', city: 'Nashik', status: 'INACTIVE', charges: { 'Single Leaf Dead Lock': 1100, 'Single Leaf Panic Bar': 1250, 'Double Leaf Dead Lock': 1700, 'Double Leaf Panic Bar': 1950, 'Glass Door': 2350, visit: 450 } },
  { id: 'i5', name: 'Nilesh Kale', phone: '98765 41025', email: 'nilesh@trackinstall.demo', city: 'Nagpur', status: 'ACTIVE', charges: { 'Single Leaf Dead Lock': 1150, 'Single Leaf Panic Bar': 1300, 'Double Leaf Dead Lock': 1750, 'Double Leaf Panic Bar': 2000, 'Glass Door': 2450, visit: 480 } },
];
const seedSites = [
  { id: 's1', name: 'ABC Residency', orderId: 'ORD-1024', customer: 'Anil Kulkarni', contact: '99887 12001', address: 'Baner Road, Pune', city: 'Pune', installerId: 'i1', assignedAt: '12 Sep 2026', status: 'IN_PROGRESS', expectedVisits: 2, doors: [{ type: 'Single Leaf Dead Lock', quantity: 8, charge: 1200 }, { type: 'Double Leaf Dead Lock', quantity: 4, charge: 1800 }], visitCharge: 500, orderFile: 'order_1024.pdf', paymentStatus: 'PAYMENT_PENDING' },
  { id: 's2', name: 'Pune Site 104', orderId: 'ORD-1041', customer: 'Riya Developers', contact: '99887 12002', address: 'Wakad, Pune', city: 'Pune', installerId: 'i2', assignedAt: '15 Sep 2026', status: 'IN_PROGRESS', expectedVisits: 3, doors: [{ type: 'Glass Door', quantity: 3, charge: 2550 }, { type: 'Single Leaf Panic Bar', quantity: 6, charge: 1400 }], visitCharge: 500, orderFile: 'pune_104.xlsx', paymentStatus: 'PAYMENT_PENDING' },
  { id: 's3', name: 'Mumbai Site 208', orderId: 'ORD-1088', customer: 'Skyline Projects', contact: '99887 12003', address: 'Andheri East, Mumbai', installerId: 'i3', assignedAt: '02 Sep 2026', status: 'COMPLETED', expectedVisits: 2, doors: [{ type: 'Double Leaf Panic Bar', quantity: 2, charge: 2150 }, { type: 'Glass Door', quantity: 4, charge: 2600 }], visitCharge: 550, orderFile: 'mumbai_208.pdf', paymentStatus: 'PAYMENT_PENDING' },
  { id: 's4', name: 'Nashik Heights', orderId: 'ORD-1096', customer: 'Kale Homes', contact: '99887 12004', address: 'College Road, Nashik', city: 'Nashik', installerId: 'i4', assignedAt: '06 Sep 2026', status: 'ASSIGNED', expectedVisits: 2, doors: [{ type: 'Double Leaf Dead Lock', quantity: 5, charge: 1700 }], visitCharge: 450, orderFile: null, paymentStatus: 'PAYMENT_PENDING' },
  { id: 's5', name: 'Nagpur Trade Center', orderId: 'ORD-1103', customer: 'Shree Group', contact: '99887 12005', address: 'Wardha Road, Nagpur', city: 'Nagpur', installerId: 'i5', assignedAt: '10 Sep 2026', status: 'COMPLETED', expectedVisits: 3, doors: [{ type: 'Single Leaf Dead Lock', quantity: 10, charge: 1150 }], visitCharge: 480, orderFile: 'nagpur_1103.docx', paymentStatus: 'PAID' },
];
const seedVisits = [
  { id: 'v1', siteId: 's1', number: 1, date: '14 Sep 2026', type: 'NORMAL', reason: 'Initial installation', remark: 'Frames installed', status: 'COMPLETED' },
  { id: 'v2', siteId: 's1', number: 2, date: '18 Sep 2026', type: 'NORMAL', reason: 'Final fitting', remark: 'Pending hardware', status: 'COMPLETED' },
  { id: 'v3', siteId: 's1', number: 3, date: '20 Sep 2026', type: 'EXTRA', reason: 'Hardware adjustment', remark: 'Customer requested revisit', status: 'PENDING_APPROVAL' },
  { id: 'v4', siteId: 's2', number: 1, date: '16 Sep 2026', type: 'NORMAL', reason: 'Initial installation', remark: 'Work started', status: 'COMPLETED' },
  { id: 'v5', siteId: 's2', number: 4, date: '21 Sep 2026', type: 'EXTRA', reason: 'Alignment correction', remark: 'Additional adjustment needed', status: 'PENDING_APPROVAL' },
  { id: 'v6', siteId: 's3', number: 1, date: '05 Sep 2026', type: 'NORMAL', reason: 'Installation', remark: 'Completed', status: 'COMPLETED' },
  { id: 'v7', siteId: 's3', number: 3, date: '09 Sep 2026', type: 'EXTRA', reason: 'Site access delay', remark: 'Approved by project lead', status: 'APPROVED' },
  { id: 'v8', siteId: 's5', number: 1, date: '12 Sep 2026', type: 'NORMAL', reason: 'Installation', remark: 'Completed', status: 'COMPLETED' },
];
export const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
// Site door rates and visitCharge are immutable assignment-time snapshots. Never read
// installer.charges here: payment and historical job totals must use the site's own data.
export const getSiteTotal = (site, visits) => { const installation = site.doors.reduce((sum, item) => sum + item.quantity * item.charge, 0); const normal = visits.filter((v) => v.siteId === site.id && v.type === 'NORMAL' && v.status === 'COMPLETED').length * site.visitCharge; const extra = visits.filter((v) => v.siteId === site.id && v.type === 'EXTRA' && v.status === 'APPROVED').length * site.visitCharge; return { installation, normal, extra, total: installation + normal + extra }; };
export function AdminDataProvider({ children }) {
  const [installers, setInstallers] = useState(seedInstallers); const [sites, setSites] = useState(seedSites); const [visits, setVisits] = useState(seedVisits); const [cities, setCities] = useState(initialCities);
  const value = useMemo(() => ({ installers, sites, visits, cities, doorTypes,
    addCity: (name) => {
      const city = name.trim();
      if (!city || cities.some((item) => item.toLowerCase() === city.toLowerCase())) return null;
      setCities((items) => [...items, city]);
      return city;
    },
    addInstaller: (installer) => setInstallers((x) => [...x, { ...installer, id: `i${Date.now()}` }]),
    updateInstaller: (installer) => setInstallers((x) => x.map((item) => item.id === installer.id ? { ...installer, charges: { ...installer.charges } } : item)),
    saveSite: (site) => {
      const snapshot = { ...site, doors: site.doors.map((item) => ({ type: item.type, quantity: Number(item.quantity), charge: Number(item.charge) })), visitCharge: Number(site.visitCharge) };
      const savedSite = snapshot.id ? snapshot : { ...snapshot, id: `s${Date.now()}`, assignedAt: '22 Sep 2026', paymentStatus: 'PAYMENT_PENDING' };
      setSites((x) => savedSite.id === snapshot.id ? x.map((item) => item.id === savedSite.id ? savedSite : item) : [...x, savedSite]);
      return savedSite;
    },
    addVisit: ({ siteId, date, reason, remark }) => {
      const nextNumber = visits.filter((item) => item.siteId === siteId).reduce((highest, item) => Math.max(highest, item.number), 0) + 1;
      const visit = { id: `v${Date.now()}`, siteId, number: nextNumber, date, type: 'EXTRA', reason, remark, status: 'PENDING_APPROVAL' };
      setVisits((items) => [...items, visit]);
      return visit;
    },
    updateVisit: (id, status) => setVisits((x) => x.map((item) => item.id === id ? { ...item, status } : item)), markPaid: (siteId) => setSites((x) => x.map((item) => item.id === siteId ? { ...item, paymentStatus: 'PAID', status: 'PAID' } : item)) }), [installers, sites, visits, cities]);
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}
export const useAdminData = () => useContext(AdminDataContext);
