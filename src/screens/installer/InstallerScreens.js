import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppHeader from '../../components/AppHeader';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import ScreenContainer from '../../components/ScreenContainer';
import StatCard from '../../components/StatCard';
import { EmptyState, FilterChips, SearchBar, SectionHeader, StatusBadge, adminStyles as s } from '../../components/AdminUI';
import { money, useAdminData } from '../../data/AdminDataContext';
import { colors, spacing, typography } from '../../theme';
import { useAuth } from '../../auth';
import { apiClient } from '../../api';

const INSTALLER_ID = 'i1';
const Page = ({ children }) => <ScreenContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.page}>{children}</ScrollView></ScreenContainer>;
const Field = ({ label, value, onChangeText, placeholder, keyboardType }) => <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder || label} keyboardType={keyboardType} style={styles.input} /></View>;
const Select = ({ label, value, options, onSelect }) => { const [open, setOpen] = useState(false); return <View style={styles.field}><Text style={styles.label}>{label}</Text><Pressable style={styles.select} onPress={() => setOpen(true)}><Text style={[styles.selectText, !value && styles.placeholder]}>{value || `Select ${label}`}</Text><Text style={styles.arrow}>⌄</Text></Pressable><Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}><Pressable style={styles.overlay} onPress={() => setOpen(false)}><View style={styles.modal}>{options.map((item) => <Pressable key={item} style={styles.option} onPress={() => { onSelect(item); setOpen(false); }}><Text style={styles.optionText}>{item}</Text></Pressable>)}</View></Pressable></Modal></View>; };
const SiteCard = ({ site, navigation }) => <Pressable style={s.card} onPress={() => navigation.navigate('InstallerSiteDetails', { siteId: site.id })}><View style={s.row}><Text style={s.cardTitle}>{site.name}</Text><StatusBadge status={site.status} /></View><Text style={s.meta}>{site.orderId} • {site.city}</Text><Text style={s.meta}>{site.customer} • {site.address}</Text></Pressable>;
const VisitCard = ({ visit, site }) => <View style={s.card}><View style={s.row}><Text style={s.cardTitle}>Visit {visit.number} • {site.name}</Text><StatusBadge status={visit.status} /></View><Text style={s.meta}>{visit.date} • {visit.type === 'EXTRA' ? 'Extra visit' : 'Normal visit'}</Text><Text style={s.meta}>{visit.reason}{visit.remark ? ` — ${visit.remark}` : ''}</Text>{visit.status === 'REJECTED' && visit.rejectionReason ? <Text style={styles.rejected}>Reason: {visit.rejectionReason}</Text> : null}</View>;

export function InstallerDashboard({ navigation }) {
  const { token } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const response = await apiClient.get(
        '/installer/jobs',
        { token }
      );

      const backendJobs = response?.data || [];

      const details = await Promise.all(
        backendJobs.map(async (job) => {
          try {
            const detailResponse = await apiClient.get(
              `/installer/jobs/${job.id}`,
              { token }
            );

            return detailResponse?.data || job;
          } catch {
            return job;
          }
        })
      );

      setJobs(details);
    } catch (err) {
      Alert.alert(
        'Unable to Load Dashboard',
        err.message || 'Failed to load assigned sites.'
      );
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadDashboard();
  }, [token]);

  const assigned = jobs.map((job) => ({
    id: job.id,
    name: job.site_name,
    orderId: job.order_id,
    city: job.city_name,
    customer: job.customer_name,
    address: job.address,
    status: job.status,
    visits: job.visits || [],
  }));

  const siteVisits = assigned.flatMap(
    (site) => site.visits
  );

  const pending = siteVisits.filter(
    (visit) =>
      visit.type === 'EXTRA' &&
      visit.status === 'PENDING_APPROVAL'
  );

  const cards = [
    {
      label: 'Assigned Sites',
      value: assigned.filter(
        (site) => site.status === 'ASSIGNED'
      ).length,
    },
    {
      label: 'Visits Completed',
      value: siteVisits.filter(
        (visit) => visit.status === 'COMPLETED'
      ).length,
    },
    {
      label: 'Pending Approvals',
      value: pending.length,
    },
    {
      label: 'Completed Sites',
      value: assigned.filter(
        (site) =>
          site.status === 'COMPLETED' ||
          site.status === 'PAID'
      ).length,
    },
  ];

  if (loading) {
    return (
      <Page>
        <Text>Loading dashboard...</Text>
      </Page>
    );
  }

  return (
    <Page>
      <AppHeader greeting="Welcome, Installer" />

      <Text style={s.title}>
        Installer Dashboard
      </Text>

      <Text style={s.subtitle}>
        View assigned sites and request extra installation visits.
      </Text>

      <View style={styles.grid}>
        {cards.map((card) => (
          <StatCard
            key={card.label}
            {...card}
          />
        ))}
      </View>

      <SectionHeader
        title="Active Sites"
        action="View All"
        onPress={() =>
          navigation.navigate('AssignedSites')
        }
      />

      {assigned
        .filter(
          (site) =>
            site.status !== 'COMPLETED' &&
            site.status !== 'PAID'
        )
        .slice(0, 3)
        .map((site) => (
          <SiteCard
            key={site.id}
            site={site}
            navigation={navigation}
          />
        ))}

      {!assigned.length ? (
        <EmptyState text="No sites assigned yet." />
      ) : null}
    </Page>
  );
}

export function AssignedSites({ navigation }) {
  const { token } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [loading, setLoading] = useState(true);

  const loadJobs = async () => {
    try {
      setLoading(true);

      const response = await apiClient.get(
        '/installer/jobs',
        { token }
      );

      setJobs(response?.data || []);
    } catch (err) {
      Alert.alert(
        'Unable to Load Sites',
        err.message || 'Failed to load assigned sites.'
      );
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadJobs();
  }, [token]);

  const list = jobs
    .map((job) => ({
      id: job.id,
      name: job.site_name,
      orderId: job.order_id,
      city: job.city_name,
      customer: job.customer_name,
      address: job.address,
      status: job.status,
    }))
    .filter(
      (site) =>
        (status === 'All' || site.status === status) &&
        `${site.name} ${site.customer} ${site.city}`
          .toLowerCase()
          .includes(query.toLowerCase())
    );

  if (loading) {
    return (
      <Page>
        <Text>Loading assigned sites...</Text>
      </Page>
    );
  }

  return (
    <Page>
      <Text style={s.title}>Assigned Sites</Text>

      <Text style={s.subtitle}>
        Your installation jobs and customer information.
      </Text>

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search site, city or customer"
      />

      <FilterChips
        options={['All', 'ASSIGNED', 'COMPLETED']}
        selected={status}
        onSelect={setStatus}
      />

      {list.length ? (
        list.map((site) => (
          <SiteCard
            key={site.id}
            site={site}
            navigation={navigation}
          />
        ))
      ) : (
        <EmptyState text="No assigned sites found." />
      )}
    </Page>
  );
}

export function InstallerSiteDetails({ route, navigation }) {
  const { token } = useAuth();
  const { siteId } = route.params;

  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSite = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await apiClient.get(
        `/installer/jobs/${siteId}`,
        { token }
      );

      setSite(response?.data || null);
    } catch (err) {
      setError(
        err.message || 'Failed to load site details.'
      );
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadSite();
  }, [siteId, token]);

  const handleMarkComplete = () => {
    Alert.alert(
      'Mark Installation Complete',
      'Are you sure the installation at this site is complete?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await apiClient.post(
                `/installer/jobs/${site.id}/complete`,
                {},
                { token }
              );

              Alert.alert(
                'Installation Completed',
                'The installation has been marked as complete.'
              );

              await loadSite();
            } catch (err) {
              Alert.alert(
                'Unable to Complete',
                err.message ||
                  'Failed to mark installation as complete.'
              );
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <Page>
        <Text>Loading site details...</Text>
      </Page>
    );
  }

  if (error || !site) {
    return (
      <Page>
        <Text style={s.title}>Site Details</Text>

        <Text style={styles.error}>
          {error || 'Site not found.'}
        </Text>

        <Pressable onPress={loadSite}>
          <Text style={styles.add}>Retry</Text>
        </Pressable>
      </Page>
    );
  }

  const doorItems = site.doorItems || [];
  const siteVisits = site.visits || [];

  const isCompleted =
    site.status === 'COMPLETED' ||
    site.status === 'PAID';

  return (
    <Page>
      <Text style={s.title}>
        {site.site_name}
      </Text>

      <Text style={s.subtitle}>
        {site.order_id} • {site.city_name}
      </Text>

      <SectionHeader title="Site Information" />

      <View style={s.card}>
        <Text style={s.meta}>
          Site Name
        </Text>

        <Text style={s.cardTitle}>
          {site.site_name}
        </Text>

        <Text style={s.meta}>
          Customer Name
        </Text>

        <Text style={s.cardTitle}>
          {site.customer_name}
        </Text>

        <Text style={s.meta}>
          Contact Number
        </Text>

        <Text style={s.cardTitle}>
          {site.contact_number}
        </Text>

        <Text style={s.meta}>
          Site Address
        </Text>

        <Text style={s.cardTitle}>
          {site.address}
        </Text>

        <Text style={s.meta}>
          City
        </Text>

        <Text style={s.cardTitle}>
          {site.city_name}
        </Text>

        <View style={styles.status}>
          <StatusBadge status={site.status} />
        </View>
      </View>

      <SectionHeader title="Door Items — Saved Rates" />

      {doorItems.map((item) => (
        <View
          key={item.door_type_id}
          style={[s.card, s.row]}
        >
          <View>
            <Text style={s.cardTitle}>
              {item.door_type}
            </Text>

            <Text style={s.meta}>
              Quantity: {item.quantity}
            </Text>
          </View>

          <Text style={styles.rate}>
            {money(
              Number(
                item.installation_charge_snapshot || 0
              )
            )}
          </Text>
        </View>
      ))}

      <View style={s.card}>
        <Text style={s.cardTitle}>
          Visit Information
        </Text>

        <Text style={s.meta}>
          Expected Visit Count:{' '}
          {site.expected_visits ?? 0}
        </Text>

        <Text style={s.meta}>
          Visits submitted: {siteVisits.length}
          {' • '}
          Visiting charge snapshot:{' '}
          {money(
            Number(
              site.visiting_charge_snapshot || 0
            )
          )}
        </Text>
      </View>

      <SectionHeader
        title="Visit History"
        action="View All"
        onPress={() =>
          navigation.navigate(
            'InstallerVisitHistory',
            {
              siteId: site.id,
            }
          )
        }
      />

      {siteVisits
        .slice(-2)
        .reverse()
        .map((visit, index) => (
          <VisitCard
            key={
              visit.id ||
              `${visit.type}-${index}`
            }
            visit={{
              ...visit,
              number:
                visit.number ||
                visit.visit_number ||
                index + 1,
              date:
                visit.date ||
                visit.visit_date ||
                '',
              reason:
                visit.reason || '',
              remark:
                visit.remark || '',
            }}
            site={{
              id: site.id,
              name: site.site_name,
            }}
          />
        ))}

      {!isCompleted && (
        <PrimaryButton
          title="Add Extra Visit"
          onPress={() =>
            navigation.navigate(
              'InstallerAddVisit',
              {
                siteId: site.id,
              }
            )
          }
        />
      )}

      {!isCompleted && (
        <PrimaryButton
          title="Mark Installation Complete"
          onPress={handleMarkComplete}
        />
      )}

      <SecondaryButton
        title="Order Form"
        onPress={() =>
          navigation.navigate(
            'InstallerOrderForm',
            {
              siteId: site.id,
            }
          )
        }
        style={styles.button}
      />
    </Page>
  );
}

export function InstallerOrderForm({ route }) { const { sites } = useAdminData(); const site = sites.find((item) => item.id === route.params.siteId); const extension = site.orderFile?.split('.').pop()?.toUpperCase(); return <Page><Text style={s.title}>Order Form</Text><Text style={s.subtitle}>{site.name}</Text><View style={s.card}><Text style={s.cardTitle}>{site.orderFile || 'No order form selected'}</Text><Text style={s.meta}>{site.orderFile ? `${extension} document — mock preview` : 'Ask your administrator to attach an order form.'}</Text></View>{site.orderFile ? <PrimaryButton title="Open Preview" onPress={() => Alert.alert('Order form preview', `Mock preview opened for ${site.orderFile}.`)} /> : null}</Page>; }

export function InstallerVisitHistory({ route, navigation }) {
  const { token } = useAuth();
  const selectedId = route.params?.siteId;

  const [visits, setVisits] = useState([]);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadVisits = async () => {
    try {
      setLoading(true);

      if (selectedId) {
        const [siteResponse, visitsResponse] =
          await Promise.all([
            apiClient.get(
              `/installer/jobs/${selectedId}`,
              { token }
            ),
            apiClient.get(
              `/installer/jobs/${selectedId}/visits`,
              { token }
            ),
          ]);

        setSite(siteResponse?.data || null);
        setVisits(visitsResponse?.data || []);
      } else {
        const jobsResponse = await apiClient.get(
          '/installer/jobs',
          { token }
        );

        const jobs = jobsResponse?.data || [];

        const visitResponses = await Promise.all(
          jobs.map((job) =>
            apiClient.get(
              `/installer/jobs/${job.id}/visits`,
              { token }
            )
          )
        );

        const allVisits = [];

        visitResponses.forEach(
          (response, index) => {
            const jobVisits = response?.data || [];

            jobVisits.forEach((visit) => {
              allVisits.push({
                ...visit,
                site_name:
                  jobs[index]?.site_name || '',
                order_id:
                  jobs[index]?.order_id || '',
              });
            });
          }
        );

        setVisits(allVisits);
      }
    } catch (err) {
      Alert.alert(
        'Unable to Load Visits',
        err.message || 'Failed to load visit history.'
      );
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadVisits();
  }, [selectedId, token]);

  if (loading) {
    return (
      <Page>
        <Text style={s.title}>
          Visit History
        </Text>

        <Text>
          Loading visits...
        </Text>
      </Page>
    );
  }

  return (
    <Page>
      <Text style={s.title}>
        Visit History
      </Text>

      <Text style={s.subtitle}>
        {selectedId
          ? 'Visits for this site.'
          : 'All submitted installation visits.'}
      </Text>

      {selectedId ? (
        <PrimaryButton
          title="Add Extra Visit"
          onPress={() =>
            navigation.navigate(
              'InstallerAddVisit',
              { siteId: selectedId }
            )
          }
        />
      ) : null}

      {site ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>
            {site.site_name}
          </Text>

          <Text style={s.meta}>
            Order ID: {site.order_id}
          </Text>

          <Text style={s.meta}>
            Expected Visits:{' '}
            {site.expected_visits ?? 0}
          </Text>
        </View>
      ) : null}

      {visits.length ? (
        visits
          .slice()
          .reverse()
          .map((visit) => (
            <VisitCard
              key={visit.id}
              visit={{
                ...visit,
                number:
                  visit.visit_number,
                date:
                  visit.visit_date,
                reason:
                  visit.reason || '',
                remark:
                  visit.remark || '',
              }}
              site={
                site
                  ? {
                      id: site.id,
                      name: site.site_name,
                    }
                  : {
                      id: visit.job_id,
                      name:
                        visit.site_name ||
                        'Installation Site',
                    }
              }
            />
          ))
      ) : (
        <EmptyState text="No visits recorded yet." />
      )}
    </Page>
  );
}

export function InstallerAddVisit({ route, navigation }) {
  const { token } = useAuth();
  const { siteId } = route.params;

  const [site, setSite] = useState(null);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const visitReasons = [
    {
      id: '233626e6-70d8-4ce1-b89a-21c9e94b6733',
      name: 'Customer unavailable',
    },
    {
      id: '31ddbc79-da86-437e-8369-8a9bef61193d',
      name: 'Material unavailable',
    },
    {
      id: 'e221434e-b12d-469d-8ca4-c30e615d254b',
      name: 'Site not ready',
    },
    {
      id: 'ce046eb3-008e-43cc-b57b-80e50e244e0c',
      name: 'Rework/Correction',
    },
    {
      id: '2f7c7b5a-0223-4f03-b271-5f389402f819',
      name: 'Installation incomplete',
    },
    {
      id: '89f92b41-d2c8-4a83-b31b-0571392b3031',
      name: 'Customer requested additional visit',
    },
    {
      id: '10e92a09-a3f2-4a24-87d9-7ccc8af7320f',
      name: 'Technical issue',
    },
    {
      id: '3b516c61-26e7-4643-a948-a0148e067c14',
      name: 'Other',
    },
  ];

  const loadSite = async () => {
    try {
      setLoading(true);

      const response = await apiClient.get(
        `/installer/jobs/${siteId}`,
        { token }
      );

      setSite(response?.data || null);

      // Use today's date as the default visit date.
      const today = new Date();

      const formattedDate = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-');

      setDate(formattedDate);
    } catch (err) {
      Alert.alert(
        'Unable to Load Site',
        err.message || 'Failed to load site details.'
      );
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadSite();
  }, [siteId, token]);

  const submit = async () => {
    if (!date || !reason) {
      Alert.alert(
        'Missing Details',
        'Select a visit date and reason.'
      );
      return;
    }

    try {
      setSaving(true);

      const response = await apiClient.post(
        `/installer/jobs/${siteId}/visits`,
        {
          visitDate: date,
          reasonId: reason,
          remark: remark.trim(),
        },
        { token }
      );

      const createdVisit = response?.data;

      Alert.alert(
        'Extra Visit Requested',
        createdVisit?.status === 'PENDING_APPROVAL'
          ? 'The extra visit has been submitted and is pending Admin approval.'
          : 'The visit has been recorded successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.replace(
                'InstallerVisitHistory',
                { siteId }
              );
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert(
        'Unable to Submit Visit',
        err.message || 'Failed to submit the visit.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <Text>Loading site...</Text>
      </Page>
    );
  }

  if (!site) {
    return (
      <Page>
        <Text style={s.title}>
          Add Extra Visit
        </Text>

        <Text style={styles.error}>
          Site not found.
        </Text>
      </Page>
    );
  }

  return (
    <Page>
      <Text style={s.title}>
        Add Extra Visit
      </Text>

      <Text style={s.subtitle}>
        {site.site_name}
      </Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>
          Admin approval required
        </Text>

        <Text style={s.meta}>
          Expected Visit Count:{' '}
          {site.expected_visits ?? 0}
        </Text>

        <Text style={s.meta}>
          Any visit beyond the expected visit count
          will be submitted as an extra visit.
        </Text>

        <Text style={s.meta}>
          Site visiting charge snapshot:{' '}
          {money(
            Number(
              site.visiting_charge_snapshot || 0
            )
          )}
        </Text>
      </View>

      <Field
        label="Visit Date"
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
      />

      <Select
        label="Reason"
        value={
          visitReasons.find(
            (item) => item.id === reason
          )?.name || ''
        }
        options={visitReasons.map(
          (item) => item.name
        )}
        onSelect={(selectedName) => {
          const selectedReason =
            visitReasons.find(
              (item) =>
                item.name === selectedName
            );

          setReason(
            selectedReason?.id || ''
          );
        }}
      />

      <Field
        label="Remark"
        value={remark}
        onChangeText={setRemark}
        placeholder="Add a short note"
      />

      <SecondaryButton
        title="Cancel"
        onPress={() => navigation.goBack()}
      />

      <PrimaryButton
        title={
          saving
            ? 'Submitting...'
            : 'Submit for Approval'
        }
        onPress={submit}
        style={styles.button}
        disabled={saving}
      />
    </Page>
  );
}

export function InstallerExtraRequests() { const { sites, visits } = useAdminData(); const [filter, setFilter] = useState('All'); const list = visits.filter((visit) => visit.type === 'EXTRA' && sites.some((site) => site.id === visit.siteId && site.installerId === INSTALLER_ID) && (filter === 'All' || visit.status === filter)); return <Page><Text style={s.title}>Extra Visit Requests</Text><Text style={s.subtitle}>Track approval status for submitted extra visits.</Text><FilterChips options={['All', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']} selected={filter} onSelect={setFilter} />{list.length ? list.slice().reverse().map((visit) => <VisitCard key={visit.id} visit={visit} site={sites.find((site) => site.id === visit.siteId)} />) : <EmptyState text="No extra visit requests found." />}</Page>; }
export function InstallerMore({ navigation }) { const { logout: authLogout } = useAuth(); const logout = async () => { if (authLogout) await authLogout(); navigation.getParent('RootStack')?.reset({ index: 0, routes: [{ name: 'AuthFlow' }] }); }; return <Page><AppHeader greeting="Rahul Patil" /><Text style={s.title}>More</Text>{[['InstallerVisitHistory', 'Visit History', 'Review all submitted visits'], ['InstallerExtraRequests', 'Extra Visit Requests', 'Track approval status']].map(([route, title, description]) => <Pressable key={route} style={s.card} onPress={() => navigation.navigate(route)}><Text style={s.cardTitle}>{title}</Text><Text style={s.meta}>{description}</Text></Pressable>)}<Pressable style={s.card} onPress={logout}><Text style={styles.logout}>Logout</Text><Text style={s.meta}>Return to Login</Text></Pressable></Page>; }
const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md, marginTop: spacing.lg }, field: { marginTop: spacing.md }, label: { ...typography.label, color: colors.text }, input: { height: 50, marginTop: spacing.xs, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, color: colors.text }, select: { minHeight: 50, marginTop: spacing.xs, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, selectText: { ...typography.body, color: colors.text }, placeholder: { color: colors.textSecondary }, arrow: { ...typography.heading, color: colors.primary }, overlay: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(23,33,43,0.35)' }, modal: { backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' }, option: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, optionText: { ...typography.body, color: colors.text }, rate: { ...typography.heading, color: colors.primary }, status: { marginTop: spacing.sm }, button: { marginTop: spacing.sm }, rejected: { ...typography.caption, color: '#B42318', marginTop: spacing.xs }, logout: { ...typography.heading, color: '#B42318' } });
