import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppHeader from '../../components/AppHeader';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import ScreenContainer from '../../components/ScreenContainer';
import StatCard from '../../components/StatCard';
import { EmptyState, FilterChips, SearchBar, SectionHeader, StatusBadge, adminStyles as s } from '../../components/AdminUI';
import { getSiteTotal, money, useAdminData } from '../../data/AdminDataContext';
import { colors, spacing, typography } from '../../theme';
import { useAuth } from '../../auth';
import { apiClient } from '../../api';
const Page = ({ children }) => <ScreenContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.page}>{children}</ScrollView></ScreenContainer>;

const InstallerRow = ({ installer, navigation }) => {
  const { sites } = useAdminData();
  const { token } = useAuth();

  const assigned = sites.filter(
    (x) => x.installerId === installer.id
  );

  const handleResendActivation = async () => {
    try {
      const response = await apiClient.post(
        `/admin/installers/${installer.id}/resend-activation`,
        {},
        { token }
      );

      const activationToken = response?.data?.activationToken;

      if (activationToken) {
        Alert.alert(
          'Activation Code',
          `New activation code for ${installer.name}:\n\n${activationToken}\n\nThis code expires in 24 hours.`
        );
      } else {
        Alert.alert(
          'Activation Code',
          'A new activation code has been generated successfully.'
        );
      }
    } catch (err) {
      Alert.alert(
        'Unable to Resend',
        err.message || 'Failed to generate a new activation code.'
      );
    }
  };

  return (
    <View style={s.card}>
      <Pressable
        onPress={() =>
          navigation.navigate('InstallerDetails', {
            installerId: installer.id,
          })
        }
      >
        <View style={s.row}>
          <Text style={s.cardTitle}>{installer.name}</Text>

          <StatusBadge
            status={installer.is_active ? 'ACTIVE' : 'INACTIVE'}
          />
        </View>

        <Text style={s.meta}>
          {installer.phone_number} • {installer.city_name}
        </Text>

        <Text style={s.meta}>
          Assigned:{' '}
          {assigned.filter(
            (x) => x.status === 'ASSIGNED'
          ).length}{' '}
          • Completed:{' '}
          {assigned.filter(
            (x) => x.status === 'COMPLETED'
          ).length}
        </Text>
      </Pressable>

      {!installer.is_active && (
        <Pressable
          onPress={handleResendActivation}
          style={s.activationButton}
        >
          <Text style={s.activationButtonText}>
            Resend Activation
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const SiteRow = ({ site, navigation }) => { const { installers, visits } = useAdminData(); const installer = installers.find((x) => x.id === site.installerId); const done = visits.filter((x) => x.siteId === site.id && x.status === 'COMPLETED').length; return <Pressable style={s.card} onPress={() => navigation.navigate('SiteDetails', { siteId: site.id })}><View style={s.row}><Text style={s.cardTitle}>{site.name}</Text><StatusBadge status={site.status} /></View><Text style={s.meta}>{site.orderId}  •  {site.city}  •  {installer?.name}</Text><Text style={s.meta}>{site.doors.map((x) => `${x.type} × ${x.quantity}`).join(', ')}</Text><Text style={s.meta}>Visits: {done}/{site.expectedVisits}  •  Payment: {site.paymentStatus.replace('_', ' ')}</Text></Pressable>; };
export function Dashboard({ navigation }) { const { installers, sites, visits, cities } = useAdminData(); const pending = visits.filter((x) => x.status === 'PENDING_APPROVAL'); const cards = [{ label: 'Total Cities', value: cities.length }, { label: 'Total Installers', value: installers.length }, { label: 'Assigned Sites', value: sites.filter((x) => x.status === 'ASSIGNED').length }, { label: 'Completed Sites', value: sites.filter((x) => x.status === 'COMPLETED').length }, { label: 'Pending Approvals', value: pending.length }, { label: 'Pending Payments', value: money(sites.filter((x) => x.paymentStatus === 'PAYMENT_PENDING').reduce((sum, x) => sum + getSiteTotal(x, visits).total, 0)) }]; return <Page><AppHeader greeting="Welcome, Admin" /><Text style={s.title}>Admin Dashboard</Text><Text style={s.subtitle}>Stay on top of installation operations.</Text><View style={styles.grid}>{cards.map((x) => <StatCard key={x.label} {...x} />)}</View><SectionHeader title="Pending Approvals" action="View All" onPress={() => navigation.navigate('Approvals')} />{pending.slice(0, 2).map((v) => { const site = sites.find((x) => x.id === v.siteId); const installer = installers.find((x) => x.id === site.installerId); return <Pressable key={v.id} onPress={() => navigation.navigate('VisitDetails', { visitId: v.id })} style={s.card}><View style={s.row}><Text style={s.cardTitle}>{site.name}</Text><StatusBadge status={v.status} /></View><Text style={s.meta}>{installer.name}  •  Visit {v.number}  •  {v.reason}</Text></Pressable>; })}<SectionHeader title="Recent Sites" action="View Sites" onPress={() => navigation.navigate('Sites')} />{sites.slice(0, 3).map((x) => <SiteRow key={x.id} site={x} navigation={navigation} />)}</Page>; }
export function MoreScreen({ navigation }) { const { logout: authLogout } = useAuth(); const logout = async () => { if (authLogout) await authLogout(); navigation.getParent('RootStack')?.reset({ index: 0, routes: [{ name: 'AuthFlow' }] }); }; return <Page><AppHeader greeting="Admin tools" /><Text style={s.title}>More</Text>{[['Sites', 'Manage assigned site jobs'], ['Installers', 'Manage your installation team'], ['Visits', 'Review all site visits'], ['Approvals', 'Approve extra visits'], ['Payments', 'Manage site payments']].map(([name, desc]) => <Pressable key={name} style={s.card} onPress={() => navigation.navigate(name)}><Text style={s.cardTitle}>{name}</Text><Text style={s.meta}>{desc}</Text></Pressable>)}<Pressable style={s.card} onPress={logout}><Text style={[s.cardTitle, styles.logout]}>Logout</Text><Text style={s.meta}>Return to Login</Text></Pressable></Page>; }
export function CitiesScreen({ navigation }) {
  const { installers, sites } = useAdminData();
  const { token } = useAuth();

  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCities = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await apiClient.get('/admin/cities', { token });

      setCities(response?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load cities.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCities();
    }, [token])
  );

  if (loading) {
    return (
      <Page>
        <Text style={s.title}>Cities</Text>
        <Text style={s.subtitle}>Loading cities...</Text>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <Text style={s.title}>Cities</Text>
        <Text style={s.subtitle}>{error}</Text>

        <Pressable onPress={loadCities}>
          <Text style={styles.add}>Retry</Text>
        </Pressable>
      </Page>
    );
  }

  return (
    <Page>
      <View style={s.row}>
        <View>
          <Text style={s.title}>Cities</Text>
          <Text style={s.subtitle}>
            View installation operations by location.
          </Text>
        </View>

        <Pressable onPress={() => navigation.navigate('AddCity')}>
          <Text style={styles.add}>+ Add City</Text>
        </Pressable>
      </View>

      {cities.map((city) => {
        const cityName = city.name;
        const citySites = sites.filter((x) => x.city === cityName);

        return (
          <Pressable
            key={city.id}
            style={s.card}
            onPress={() =>
              navigation.navigate('CityDetails', { city: cityName })
            }
          >
            <Text style={s.cardTitle}>{cityName}</Text>

            <Text style={s.meta}>
              Installers:{' '}
              {installers.filter((x) => x.city === cityName).length}
              {' • '}
              Assigned Sites:{' '}
              {citySites.filter((x) => x.status === 'ASSIGNED').length}
            </Text>

            <Text style={s.meta}>
              Completed:{' '}
              {citySites.filter((x) => x.status === 'COMPLETED').length}
            </Text>
          </Pressable>
        );
      })}
    </Page>
  );
}

export function AddCity({ navigation }) {
  const { token } = useAuth();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const cityName = name.trim();

    if (!cityName) {
      Alert.alert('Unable to save city', 'City Name is required.');
      return;
    }

    try {
      setSaving(true);

      await apiClient.post(
        '/admin/cities',
        { name: cityName },
        { token }
      );

      Alert.alert(
        'City added',
        `${cityName} has been added successfully.`
      );

      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'Unable to save city',
        err.message || 'Failed to add city.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Text style={s.title}>Add City</Text>

      <Text style={s.subtitle}>
        Create a city for installer and site assignments.
      </Text>

      <Field
        label="City Name"
        value={name}
        onChangeText={setName}
        placeholder="Enter city name"
      />

      <SecondaryButton
        title="Cancel"
        onPress={() => navigation.goBack()}
      />

      <PrimaryButton
        title={saving ? 'Saving...' : 'Save City'}
        onPress={save}
        style={styles.actionButton}
        disabled={saving}
      />
    </Page>
  );
}
export function CityDetails({ route, navigation }) { const { city } = route.params; const { installers, sites, visits } = useAdminData(); const cityInstallers = installers.filter((x) => x.city === city), citySites = sites.filter((x) => x.city === city); return <Page><Text style={s.title}>{city}</Text><Text style={s.subtitle}>City operations overview</Text><View style={styles.grid}>{[{ label: 'Installers', value: cityInstallers.length }, { label: 'Assigned Sites', value: citySites.filter((x) => x.status === 'ASSIGNED').length }, { label: 'Completed', value: citySites.filter((x) => x.status === 'COMPLETED').length }, { label: 'Pending Visits', value: visits.filter((x) => citySites.some((a) => a.id === x.siteId) && x.status === 'PENDING_APPROVAL').length }].map((x) => <StatCard key={x.label}{...x} />)}</View><SectionHeader title="Installers in this city" />{cityInstallers.map((x) => <InstallerRow key={x.id} installer={x} navigation={navigation} />)}<SectionHeader title="Sites in this city" />{citySites.map((x) => <SiteRow key={x.id} site={x} navigation={navigation} />)}</Page>; }

export function InstallersScreen({ navigation }) {
  const { cities } = useAdminData();
  const { token } = useAuth();

  const [installers, setInstallers] = useState([]);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('All');
  const [status, setStatus] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadInstallers = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await apiClient.get('/admin/installers', { token });
      
      setInstallers(response?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load installers.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadInstallers();
    }, [token])
  );

  const list = installers.filter(
    (x) =>
      (city === 'All' || x.city_name === city) &&
      (status === 'All' ||
        (status === 'ACTIVE' && x.is_active) ||
        (status === 'INACTIVE' && !x.is_active)) &&
      x.name.toLowerCase().includes(query.toLowerCase())
  );

  if (loading) {
    return (
      <Page>
        <Text style={s.title}>Installers</Text>
        <Text style={s.subtitle}>Loading installers...</Text>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <Text style={s.title}>Installers</Text>
        <Text style={s.subtitle}>{error}</Text>

        <Pressable onPress={loadInstallers}>
          <Text style={styles.add}>Retry</Text>
        </Pressable>
      </Page>
    );
  }

  return (
    <Page>
      <View style={s.row}>
        <View>
          <Text style={s.title}>Installers</Text>
          <Text style={s.subtitle}>Manage your installation team.</Text>
        </View>

        <Pressable onPress={() => navigation.navigate('AddInstaller')}>
          <Text style={styles.add}>+ Add</Text>
        </Pressable>
      </View>

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search installer"
      />

      <FilterChips
        options={['All', ...cities]}
        selected={city}
        onSelect={setCity}
      />

      <FilterChips
        options={['All', 'ACTIVE', 'INACTIVE']}
        selected={status}
        onSelect={setStatus}
      />

      {list.length ? (
        list.map((x) => (
          <InstallerRow
            key={x.id}
            installer={x}
            navigation={navigation}
          />
        ))
      ) : (
        <EmptyState text="No installers found for these filters." />
      )}
    </Page>
  );
}

export function InstallerDetails({ route, navigation }) { const { installerId } = route.params; const { installers, sites, visits } = useAdminData(); const installer = installers.find((x) => x.id === installerId), assigned = sites.filter((x) => x.installerId === installerId); const earnings = assigned.reduce((sum, x) => sum + getSiteTotal(x, visits).total, 0); return <Page><Text style={s.title}>{installer.name}</Text><Text style={s.subtitle}>{installer.phone}  •  {installer.email}</Text><View style={[s.card, s.row]}><Text style={s.meta}>{installer.city}</Text><StatusBadge status={installer.status} /></View><PrimaryButton title="Edit Current Charges" onPress={() => navigation.navigate('EditInstaller', { installerId })} /><SectionHeader title="Current Master Charges" />{Object.entries(installer.charges).filter(([k]) => k !== 'visit').map(([k, v]) => <View key={k} style={[s.card, s.row]}><Text style={s.cardTitle}>{k}</Text><Text style={s.meta}>{money(v)}</Text></View>)}<View style={[s.card, s.row]}><Text style={s.cardTitle}>Visiting Charge</Text><Text style={s.meta}>{money(installer.charges.visit)}</Text></View><Text style={s.meta}>These rates are used for future assignments only; assigned sites retain their historical snapshots.</Text><View style={styles.grid}>{[{ label: 'Assigned Sites', value: assigned.length }, { label: 'Total Visits', value: visits.filter((x) => assigned.some((a) => a.id === x.siteId)).length }, { label: 'Pending Approvals', value: visits.filter((x) => assigned.some((a) => a.id === x.siteId) && x.status === 'PENDING_APPROVAL').length }, { label: 'Total Earnings', value: money(earnings) }].map((x) => <StatCard key={x.label}{...x} />)}</View><SectionHeader title="Historical Assigned Jobs" />{assigned.map((x) => <SiteRow key={x.id} site={x} navigation={navigation} />)}</Page>; }
const Field = ({ label, value, onChangeText, placeholder, keyboardType }) => <View style={styles.field}><Text style={styles.fieldLabel}>{label} *</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder || label} keyboardType={keyboardType} style={styles.input} /></View>;
const SelectField = ({ label, value, placeholder, options, onSelect, disabled, error }) => { const [open, setOpen] = useState(false); return <View style={styles.field}><Text style={styles.fieldLabel}>{label} *</Text><Pressable disabled={disabled} onPress={() => setOpen(true)} style={[styles.select, disabled && styles.selectDisabled, error && styles.selectError]}><Text style={[styles.selectText, !value && styles.placeholder]}>{value || placeholder}</Text><Text style={styles.chevron}>⌄</Text></Pressable>{error ? <Text style={styles.error}>{error}</Text> : null}<Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}><Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}><View style={styles.modalCard}>{options.map((option) => <Pressable key={option} onPress={() => { onSelect(option); setOpen(false); }} style={styles.option}><Text style={styles.optionText}>{option}</Text></Pressable>)}</View></Pressable></Modal></View>; };
export function AddInstaller({ navigation }) {
  const { doorTypes } = useAdminData();

  const doorTypeIds = {
    'Single Leaf Dead Lock': '724d8caf-483f-47f6-9460-d86a9b90b7b5',
    'Single Leaf Panic Bar': '9a0e492e-325b-4372-80a7-2c1b07dc042d',
    'Double Leaf Dead Lock': 'bfdbd99f-feef-491d-9c9c-757761ab448c',
    'Double Leaf Panic Bar': 'e6a09665-d325-4f81-958a-fe423263d081',
    'Glass Door': 'e31726c7-c7ec-4036-878c-1db96a1825a2',
  };

  const { token } = useAuth();

  const [cities, setCities] = useState([]);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    visit: '500',
  });
  const [loadingCities, setLoadingCities] = useState(true);

  useEffect(() => {
    const loadCities = async () => {
      try {
        const response = await apiClient.get('/admin/cities', { token });
        const cityList = response?.data || [];

        setCities(cityList);

        if (cityList.length) {
          setForm((current) => ({
            ...current,
            city: cityList[0].name,
          }));
        }
      } catch (err) {
        Alert.alert(
          'Unable to load cities',
          err.message || 'Failed to load cities.'
        );
      } finally {
        setLoadingCities(false);
      }
    };

    loadCities();
  }, [token]);

  const [saving, setSaving] = useState(false);

  const set = (key) => (value) =>
    setForm((x) => ({ ...x, [key]: value }));

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      Alert.alert(
        'Missing details',
        'Please complete name, phone and email.'
      );
      return;
    }

    const selectedCity = cities.find(
      (item) => item.name === form.city
    );

    if (!selectedCity?.id) {
      Alert.alert('Missing details', 'Please select a valid city.');
      return;
    }

    try {
      setSaving(true);

      const doorCharges = doorTypes.map((type) => {
        const doorTypeId = doorTypeIds[type];

        if (!doorTypeId) {
          throw new Error(`Missing door type ID for: ${type}`);
        }

        return {
          doorTypeId,
          installationCharge: Number(form[type] || 1200),
        };
      });

      const payload = {
        name: form.name.trim(),
        phoneNumber: form.phone.trim(),
        email: form.email.trim(),
        cityId: selectedCity.id,
        visitingCharge: Number(form.visit || 0),
        doorCharges,
      };

      const response = await apiClient.post(
        '/admin/installers',
        payload,
        { token }
      );

      const activationToken = response?.data?.activationToken;

      if (activationToken) {
        Alert.alert(
          'Installer created',
          `${form.name.trim()} has been created.\n\nActivation Token:\n${activationToken}\n\nShare this token with the installer. It expires in 24 hours.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert(
          'Installer created',
          `${form.name.trim()} has been created successfully.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (err) {
      Alert.alert(
        'Unable to save installer',
        err.message || 'Failed to add installer.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Text style={s.title}>Add Installer</Text>

      <Text style={s.subtitle}>
        Set master rates for future site assignments.
      </Text>

      <Field
        label="Full Name"
        value={form.name}
        onChangeText={set('name')}
      />

      <Field
        label="Phone Number"
        value={form.phone}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
      />

      <Field
        label="Email"
        value={form.email}
        onChangeText={set('email')}
        keyboardType="email-address"
      />

      <Text style={styles.fieldLabel}>City *</Text>

      <FilterChips
        options={cities.map((city) => city.name)}
        selected={form.city}
        onSelect={(city) =>
          setForm((x) => ({ ...x, city }))
        }
      />

      <SectionHeader title="Current Master Charges" />

      {doorTypes.map((type) => (
        <Field
          key={type}
          label={type}
          value={form[type] || '1200'}
          onChangeText={set(type)}
          keyboardType="numeric"
        />
      ))}

      <Field
        label="Visiting Charge"
        value={form.visit}
        onChangeText={set('visit')}
        keyboardType="numeric"
      />

      <SecondaryButton
        title="Cancel"
        onPress={() => navigation.goBack()}
      />

      <PrimaryButton
        title={
          saving
            ? 'Saving...'
            : loadingCities
              ? 'Loading Cities...'
              : 'Save Installer'
        }
        onPress={save}
        disabled={saving || loadingCities}
        style={styles.actionButton}
      />
    </Page>
  );
}
export function EditInstaller({ route, navigation }) { const { installerId } = route.params; const { installers, doorTypes, updateInstaller } = useAdminData(); const installer = installers.find((item) => item.id === installerId); const [charges, setCharges] = useState({ ...installer.charges }); const save = () => { updateInstaller({ ...installer, charges: { ...doorTypes.reduce((all, type) => ({ ...all, [type]: Number(charges[type] || 0) }), {}), visit: Number(charges.visit || 0) } }); Alert.alert('Master charges updated', 'Existing sites keep their saved historical rates. Future assignments use these new rates.'); navigation.goBack(); }; return <Page><Text style={s.title}>Edit Installer Charges</Text><Text style={s.subtitle}>{installer.name} — these are current master charges only.</Text><SectionHeader title="Current Master Charges" />{doorTypes.map((type) => <Field key={type} label={type} value={String(charges[type] || '')} onChangeText={(value) => setCharges((item) => ({ ...item, [type]: value }))} keyboardType="numeric" />)}<Field label="Visiting Charge" value={String(charges.visit || '')} onChangeText={(value) => setCharges((item) => ({ ...item, visit: value }))} keyboardType="numeric" /><Text style={s.meta}>Assigned sites retain their own door and visiting-charge snapshots.</Text><SecondaryButton title="Cancel" onPress={() => navigation.goBack()} /><PrimaryButton title="Save Current Charges" onPress={save} style={styles.actionButton} /></Page>; }
export function EditInstallerWithCity({ route, navigation }) { const { installerId } = route.params; const { installers, cities, doorTypes, updateInstaller } = useAdminData(); const installer = installers.find((item) => item.id === installerId); const [city, setCity] = useState(installer.city); const [charges, setCharges] = useState({ ...installer.charges }); const save = () => { updateInstaller({ ...installer, city, charges: { ...doorTypes.reduce((all, type) => ({ ...all, [type]: Number(charges[type] || 0) }), {}), visit: Number(charges.visit || 0) } }); Alert.alert('Installer updated', 'City and current master charges have been saved. Existing site snapshots are unchanged.'); navigation.goBack(); }; return <Page><Text style={s.title}>Edit Installer</Text><Text style={s.subtitle}>{installer.name}</Text><Text style={styles.fieldLabel}>City *</Text><FilterChips options={cities} selected={city} onSelect={setCity} /><SectionHeader title="Current Master Charges" />{doorTypes.map((type) => <Field key={type} label={type} value={String(charges[type] || '')} onChangeText={(value) => setCharges((item) => ({ ...item, [type]: value }))} keyboardType="numeric" />)}<Field label="Visiting Charge" value={String(charges.visit || '')} onChangeText={(value) => setCharges((item) => ({ ...item, visit: value }))} keyboardType="numeric" /><Text style={s.meta}>Existing site charges remain historical snapshots.</Text><SecondaryButton title="Cancel" onPress={() => navigation.goBack()} /><PrimaryButton title="Save Installer" onPress={save} style={styles.actionButton} /></Page>; }
export function SitesScreen({ navigation }) {
  const { sites, cities, installers } = useAdminData(); const [query, setQuery] = useState(''), [city, setCity] = useState('All'), [status, setStatus] = useState('All'); const list = sites.filter(
    (x) =>
      (city === 'All' || x.city === city) &&
      (
        status === 'All' ||
        (status === 'PAYMENT_PENDING'
          ? x.paymentStatus === 'PAYMENT_PENDING'
          : x.status === status)
      ) &&
      `${x.name} ${x.orderId}`.toLowerCase().includes(query.toLowerCase())
  ); return <Page><View style={s.row}><View><Text style={s.title}>Sites / Jobs</Text><Text style={s.subtitle}>Manage assigned installation work.</Text></View><Pressable onPress={() => navigation.navigate('AssignSite')}><Text style={styles.add}>+ Assign</Text></Pressable></View><SearchBar value={query} onChangeText={setQuery} placeholder="Search site or order ID" /><FilterChips options={['All', ...cities]} selected={city} onSelect={setCity} /><FilterChips
    options={['All', 'ASSIGNED', 'COMPLETED', 'PAYMENT_PENDING', 'PAID']}
    selected={status}
    onSelect={setStatus}
  />{list.length ? list.map((x) => <SiteRow key={x.id} site={x} navigation={navigation} />) : <EmptyState text="No sites found for these filters." />}</Page>;
}
export function AssignSite({ navigation, route }) { const { installers, cities, doorTypes, saveSite } = useAdminData(); const current = route.params?.siteId; const existing = useAdminData().sites.find((x) => x.id === current); const [form, setForm] = useState(existing || { name: '', orderId: '', customer: '', contact: '', address: '', city: cities[0], installerId: installers[0].id, expectedVisits: '2', visitCharge: String(installers[0].charges.visit), doors: [{ type: 'Single Leaf', quantity: '1', charge: String(installers[0].charges['Single Leaf']) }], orderFile: null, status: 'ASSIGNED' }); const installer = installers.find((x) => x.id === form.installerId); const changeInstaller = (id) => { const i = installers.find((x) => x.id === id); setForm((x) => ({ ...x, installerId: id, visitCharge: String(i.charges.visit), doors: x.doors.map((d) => ({ ...d, charge: String(i.charges[d.type]) })) })); }; const total = form.doors.reduce((sum, d) => sum + Number(d.quantity || 0) * Number(d.charge || 0), 0) + Number(form.expectedVisits || 0) * Number(form.visitCharge || 0); const save = () => { if (!form.name || !form.orderId || !form.customer) return Alert.alert('Missing details', 'Complete the required site information.'); saveSite({ ...form, expectedVisits: Number(form.expectedVisits), visitCharge: Number(form.visitCharge), doors: form.doors.map((d) => ({ ...d, quantity: Number(d.quantity), charge: Number(d.charge) })) }); Alert.alert(existing ? 'Site updated' : 'Site assigned', existing ? 'Site changes saved.' : 'The site has been assigned in local demo data.'); navigation.goBack(); }; return <Page><Text style={s.title}>{existing ? 'Edit Site' : 'Assign New Site'}</Text><Text style={s.subtitle}>Installer rates are captured with this job.</Text>{['name', 'orderId', 'customer', 'contact', 'address'].map((x) => <Field key={x} label={x === 'orderId' ? 'Order ID' : x === 'customer' ? 'Customer Name' : x === 'contact' ? 'Customer Contact' : x === 'address' ? 'Site Address' : 'Site Name'} value={form[x]} onChangeText={(v) => setForm((a) => ({ ...a, [x]: v }))} />)}<Text style={styles.fieldLabel}>City *</Text><FilterChips options={cities} selected={form.city} onSelect={(city) => setForm((x) => ({ ...x, city }))} /><Text style={styles.fieldLabel}>Select Installer *</Text><FilterChips options={installers.filter((x) => x.status === 'ACTIVE').map((x) => x.name)} selected={installer?.name} onSelect={(name) => changeInstaller(installers.find((x) => x.name === name).id)} /><Text style={s.meta}>Selected: {installer?.name} • Visit charge {money(form.visitCharge)}</Text><SectionHeader title="Door Items" />{form.doors.map((d, index) => <View key={index} style={s.card}><FilterChips options={doorTypes} selected={d.type} onSelect={(type) => setForm((x) => ({ ...x, doors: x.doors.map((a, i) => i === index ? { ...a, type, charge: String(installer.charges[type]) } : a) }))} /><Field label="Quantity" value={String(d.quantity)} onChangeText={(v) => setForm((x) => ({ ...x, doors: x.doors.map((a, i) => i === index ? { ...a, quantity: v } : a) }))} keyboardType="numeric" /><Field label="Installation Charge" value={String(d.charge)} onChangeText={(v) => setForm((x) => ({ ...x, doors: x.doors.map((a, i) => i === index ? { ...a, charge: v } : a) }))} keyboardType="numeric" />{form.doors.length > 1 ? <Pressable onPress={() => setForm((x) => ({ ...x, doors: x.doors.filter((_, i) => i !== index) }))}><Text style={styles.remove}>Remove door type</Text></Pressable> : null}</View>)}<Pressable onPress={() => setForm((x) => ({ ...x, doors: [...x.doors, { type: 'Double Leaf', quantity: '1', charge: String(installer.charges['Double Leaf']) }] }))}><Text style={styles.add}>+ Add Door Type</Text></Pressable><Field label="Expected Visit Count" value={String(form.expectedVisits)} onChangeText={(v) => setForm((x) => ({ ...x, expectedVisits: v }))} keyboardType="numeric" /><Field label="Visiting Charge" value={String(form.visitCharge)} onChangeText={(v) => setForm((x) => ({ ...x, visitCharge: v }))} keyboardType="numeric" /><View style={s.card}><Text style={s.cardTitle}>Estimated Job Total</Text><Text style={styles.total}>{money(total)}</Text><Pressable onPress={() => setForm((x) => ({ ...x, orderFile: x.orderFile ? 'order_form.pdf' : 'order_1024.pdf' }))}><Text style={styles.add}>{form.orderFile ? `Selected: ${form.orderFile}` : 'Upload Order Form (mock)'}</Text></Pressable></View><SecondaryButton title="Cancel" onPress={() => navigation.goBack()} /><PrimaryButton title={existing ? 'Save Changes' : 'Assign Site'} onPress={save} style={styles.actionButton} /></Page>; }
export function AssignNewSiteFinal({ navigation, route }) {
  const { installers, cities, doorTypes, sites, saveSite } = useAdminData();

  const editingSiteId = route?.params?.siteId;
  const existingSite = editingSiteId
    ? sites.find((item) => item.id === editingSiteId)
    : null;

  const [form, setForm] = useState(() => {
    if (existingSite) {
      return {
        ...existingSite,
        city: existingSite.city || '',
        installerId: existingSite.installerId || '',
        expectedVisits: String(existingSite.expectedVisits ?? 0),
        visitCharge: String(existingSite.visitCharge ?? ''),
        doors: existingSite.doors.map((item) => ({
          type: item.type,
          quantity: String(item.quantity),
          charge: String(item.charge),
        })),
      };
    }

    return {
      name: '',
      orderId: '',
      customer: '',
      contact: '',
      address: '',
      city: '',
      installerId: '',
      expectedVisits: '0',
      visitCharge: '',
      doors: [{ type: '', quantity: '', charge: '' }],
      orderFile: null,
      status: 'ASSIGNED',
    };
  });

  const activeInstallers = installers.filter(
    (item) => item.status === 'ACTIVE' && item.city === form.city
  );

  const installer = installers.find(
    (item) => item.id === form.installerId
  );

  const update = (changes) => {
    setForm((item) => ({ ...item, ...changes }));
  };

  const updateDoor = (index, changes) => {
    setForm((item) => ({
      ...item,
      doors: item.doors.map((door, doorIndex) =>
        doorIndex === index ? { ...door, ...changes } : door
      ),
    }));
  };

  const usedDoorTypes = form.doors
    .map((item) => item.type)
    .filter(Boolean);

  const installationTotal = form.doors.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity || 0) * Number(item.charge || 0),
    0
  );

  const visitTotal =
    Number(form.expectedVisits || 0) *
    Number(form.visitCharge || 0);

  const selectCity = (city) => {
    update({
      city,
      installerId: '',
      visitCharge: '',
      doors: form.doors.map((item) => ({
        ...item,
        charge: '',
      })),
    });
  };

  const selectInstaller = (name) => {
    const selected = activeInstallers.find(
      (item) => item.name === name
    );

    if (!selected) return;

    update({
      installerId: selected.id,
      visitCharge: String(selected.charges.visit),
      doors: form.doors.map((item) => ({
        ...item,
        charge: item.type
          ? String(selected.charges[item.type] ?? '')
          : '',
      })),
    });
  };

  const selectDoorType = (index, type) => {
    if (!installer) return;

    updateDoor(index, {
      type,
      charge: String(installer.charges[type] ?? ''),
    });
  };

  const save = () => {
    const invalid =
      !form.name ||
      !form.orderId ||
      !form.customer ||
      !form.contact ||
      !form.address ||
      !form.city ||
      !installer ||
      form.doors.some(
        (item) =>
          !item.type ||
          Number(item.quantity) <= 0 ||
          Number(item.charge) < 0
      );

    if (invalid) {
      Alert.alert(
        'Complete required fields',
        'Enter site details, city, installer, and valid door items.'
      );
      return;
    }

    const saved = saveSite({
      ...form,
      expectedVisits: Number(form.expectedVisits || 0),
      visitCharge: Number(form.visitCharge || 0),
      doors: form.doors.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        charge: Number(item.charge),
      })),
    });

    Alert.alert(
      editingSiteId ? 'Site updated' : 'Site assigned',
      editingSiteId
        ? 'Site changes saved. Historical charge snapshots are preserved.'
        : 'Current installer charges have been saved as this job’s historical snapshot.'
    );

    navigation.replace('SiteDetails', {
      siteId: saved.id,
    });
  };

  return (
    <Page>
      <Text style={s.title}>
        {editingSiteId ? 'Edit Site' : 'Assign New Site'}
      </Text>

      <Text style={s.subtitle}>
        {editingSiteId
          ? 'Edit site details while preserving the site’s saved charge snapshots.'
          : 'Current master rates are copied into this job when it is assigned.'}
      </Text>

      <SectionHeader title="Site Information" />

      {[
        ['name', 'Site Name'],
        ['orderId', 'Order ID'],
        ['customer', 'Customer Name'],
        ['contact', 'Customer Contact'],
        ['address', 'Site Address'],
      ].map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={form[key]}
          onChangeText={(value) => update({ [key]: value })}
        />
      ))}

      <SectionHeader title="Assignment" />

      <SelectField
        label="City"
        value={form.city}
        placeholder="Select City"
        options={cities}
        onSelect={selectCity}
      />

      <SelectField
        label="Installer"
        value={installer?.name}
        placeholder={
          form.city ? 'Select Installer' : 'Select City first'
        }
        options={activeInstallers.map((item) => item.name)}
        onSelect={selectInstaller}
        disabled={!form.city || !activeInstallers.length}
      />

      {form.city && !activeInstallers.length ? (
        <Text style={styles.error}>
          No active installers available in this city.
        </Text>
      ) : null}

      {installer ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>{installer.name}</Text>
          <Text style={s.meta}>
            {installer.phone} • {installer.city}
          </Text>
          <Text style={s.meta}>
            Current visiting charge: {money(installer.charges.visit)}
          </Text>
        </View>
      ) : null}

      <SectionHeader title="Door Details" />

      {form.doors.map((door, index) => {
        const options = doorTypes.filter(
          (type) =>
            type === door.type ||
            !usedDoorTypes.includes(type)
        );

        return (
          <View key={index} style={s.card}>
            <Text style={s.cardTitle}>
              Door Item {index + 1}
            </Text>

            <SelectField
              label="Door Type"
              value={door.type}
              placeholder="Select Door Type"
              options={options}
              onSelect={(type) =>
                selectDoorType(index, type)
              }
              disabled={!installer}
            />

            <Field
              label="Quantity"
              value={String(door.quantity)}
              onChangeText={(quantity) =>
                updateDoor(index, { quantity })
              }
              keyboardType="numeric"
            />

            <Field
              label="Installation Charge"
              value={String(door.charge)}
              onChangeText={(charge) =>
                updateDoor(index, { charge })
              }
              keyboardType="numeric"
            />

            <Text style={styles.total}>
              Total:{' '}
              {money(
                Number(door.quantity || 0) *
                Number(door.charge || 0)
              )}
            </Text>

            {form.doors.length > 1 ? (
              <Pressable
                onPress={() =>
                  setForm((item) => ({
                    ...item,
                    doors: item.doors.filter(
                      (_, doorIndex) =>
                        doorIndex !== index
                    ),
                  }))
                }
              >
                <Text style={styles.remove}>
                  Remove door type
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {installer &&
        usedDoorTypes.length < doorTypes.length ? (
        <Pressable
          onPress={() =>
            update({
              doors: [
                ...form.doors,
                {
                  type: '',
                  quantity: '',
                  charge: '',
                },
              ],
            })
          }
        >
          <Text style={styles.add}>
            + Add Door Type
          </Text>
        </Pressable>
      ) : null}

      <SectionHeader title="Visit Details" />

      <Field
        label="Expected Visit Count"
        value={String(form.expectedVisits)}
        onChangeText={(expectedVisits) =>
          update({ expectedVisits })
        }
        keyboardType="numeric"
      />

      <Field
        label="Visiting Charge"
        value={String(form.visitCharge)}
        onChangeText={(visitCharge) =>
          update({ visitCharge })
        }
        keyboardType="numeric"
      />

      <SectionHeader title="Order Form" />

      <View style={s.card}>
        <Pressable
          onPress={() =>
            update({
              orderFile: form.orderFile
                ? 'order_form.xlsx'
                : 'order_form.pdf',
            })
          }
        >
          <Text style={styles.add}>
            {form.orderFile
              ? `Selected: ${form.orderFile}`
              : 'Upload / Select Order Form (mock)'}
          </Text>
        </Pressable>
      </View>

      <SectionHeader title="Financial Summary" />

      <View style={s.card}>
        <Text style={s.meta}>
          Installation Total: {money(installationTotal)}
        </Text>

        <Text style={s.meta}>
          Expected Visit Cost: {money(visitTotal)}
        </Text>

        <Text style={styles.total}>
          Estimated Job Total:{' '}
          {money(installationTotal + visitTotal)}
        </Text>
      </View>

      <SecondaryButton
        title="Cancel"
        onPress={() => navigation.goBack()}
      />

      <PrimaryButton
        title={editingSiteId ? 'Save Changes' : 'Assign Site'}
        onPress={save}
        style={styles.actionButton}
      />
    </Page>
  );
}
export function SiteDetails({ route, navigation }) { const { siteId } = route.params; const { sites, installers, visits } = useAdminData(); const site = sites.find((x) => x.id === siteId), installer = installers.find((x) => x.id === site.installerId), siteVisits = visits.filter((x) => x.siteId === siteId), total = getSiteTotal(site, visits); return <Page><Text style={s.title}>{site.name}</Text><Text style={s.subtitle}>{site.orderId}  •  {site.city}</Text><View style={[s.card, s.row]}><Text style={s.meta}>{site.customer} • {site.contact}</Text><StatusBadge status={site.status} /></View><Text style={s.meta}>{site.address}</Text><SectionHeader title="Door Details" />{site.doors.map((x) => <View key={x.type} style={[s.card, s.row]}><Text style={s.cardTitle}>{x.type} × {x.quantity}</Text><Text style={s.meta}>{money(x.charge * x.quantity)}</Text></View>)}<SectionHeader title="Visit Information" /><View style={s.card}><Text style={s.meta}>Expected: {site.expectedVisits}  •  Completed: {siteVisits.filter((x) => x.status === 'COMPLETED').length}  •  Extra: {siteVisits.filter((x) => x.type === 'EXTRA').length}</Text><Text style={s.meta}>Approved: {siteVisits.filter((x) => x.status === 'APPROVED').length}  •  Pending: {siteVisits.filter((x) => x.status === 'PENDING_APPROVAL').length}</Text></View><SectionHeader title="Payment Summary" /><View style={s.card}><Text style={s.meta}>Installation: {money(total.installation)} • Normal visits: {money(total.normal)}</Text><Text style={s.meta}>Approved extra: {money(total.extra)}</Text><Text style={styles.total}>Total payable: {money(total.total)}</Text><StatusBadge status={site.paymentStatus} /></View><View style={s.card}><Text style={s.cardTitle}>Order Form</Text><Text style={s.meta}>{site.orderFile || 'No file selected'}</Text><Pressable onPress={() => Alert.alert('Order form', 'This demo does not download files.')}><Text style={styles.add}>View / Download</Text></Pressable></View><PrimaryButton title="View Visits" onPress={() => navigation.navigate('Visits', { siteId })} /><SecondaryButton title="Edit Site" onPress={() => navigation.navigate('EditSite', { siteId })} style={styles.actionButton} /><SecondaryButton title="View Installer" onPress={() => navigation.navigate('InstallerDetails', { installerId: installer.id })} style={styles.actionButton} /></Page>; }
export function VisitsScreen({ navigation, route }) { const { visits, sites, installers } = useAdminData(); const [filter, setFilter] = useState('All'); const list = visits.filter((x) => !route.params?.siteId || x.siteId === route.params.siteId).filter((x) => filter === 'All' || (filter === 'Normal' && x.type === 'NORMAL') || (filter === 'Extra' && x.type === 'EXTRA') || (filter === 'Pending' && x.status === 'PENDING_APPROVAL') || (filter === 'Approved' && x.status === 'APPROVED') || (filter === 'Rejected' && x.status === 'REJECTED')); return <Page><Text style={s.title}>Visits</Text><Text style={s.subtitle}>All normal and extra installation visits.</Text><FilterChips options={['All', 'Normal', 'Extra', 'Pending', 'Approved', 'Rejected']} selected={filter} onSelect={setFilter} />{list.length ? list.map((v) => { const site = sites.find((x) => x.id === v.siteId), ins = installers.find((x) => x.id === site.installerId); return <Pressable key={v.id} style={s.card} onPress={() => navigation.navigate('VisitDetails', { visitId: v.id })}><View style={s.row}><Text style={s.cardTitle}>{site.name} • Visit {v.number}</Text><StatusBadge status={v.status} /></View><Text style={s.meta}>{ins.name} • {v.date} • {v.type}</Text><Text style={s.meta}>{v.reason} • Charge {money(site.visitCharge)}</Text></Pressable> }) : <EmptyState text="No visits found." />}</Page>; }
export function VisitDetails({ route, navigation }) { const { visitId } = route.params; const { visits, sites, installers, updateVisit } = useAdminData(); const v = visits.find((x) => x.id === visitId), site = sites.find((x) => x.id === v.siteId), ins = installers.find((x) => x.id === site.installerId); const decide = (status) => { updateVisit(v.id, status); Alert.alert(status === 'APPROVED' ? 'Visit approved' : 'Visit rejected', 'Local payment totals have been updated.'); navigation.goBack(); }; return <Page><Text style={s.title}>Visit {v.number}</Text><Text style={s.subtitle}>{site.name} • {ins.name}</Text><View style={s.card}><Text style={s.meta}>Date: {v.date}</Text><Text style={s.meta}>Type: {v.type} • Charge: {money(site.visitCharge)}</Text><Text style={s.meta}>Reason: {v.reason}</Text><Text style={s.meta}>Remark: {v.remark}</Text><View style={{ marginTop: spacing.sm }}><StatusBadge status={v.status} /></View></View>{v.status === 'PENDING_APPROVAL' ? <><PrimaryButton title="Approve" onPress={() => decide('APPROVED')} /><SecondaryButton title="Reject" onPress={() => decide('REJECTED')} style={styles.actionButton} /></> : null}</Page>; }
export function ApprovalsScreen({ navigation }) { const { visits, sites, installers, updateVisit } = useAdminData(); const [tab, setTab] = useState('Pending'); const list = visits.filter((x) => x.type === 'EXTRA' && (tab === 'Pending' ? x.status === 'PENDING_APPROVAL' : x.status === tab.toUpperCase())); return <Page><Text style={s.title}>Extra Visit Approvals</Text><Text style={s.subtitle}>{visits.filter((x) => x.status === 'PENDING_APPROVAL').length} requests awaiting action.</Text><FilterChips options={['Pending', 'Approved', 'Rejected']} selected={tab} onSelect={setTab} />{list.length ? list.map((v) => { const site = sites.find((x) => x.id === v.siteId), ins = installers.find((x) => x.id === site.installerId); return <View key={v.id} style={s.card}><View style={s.row}><Text style={s.cardTitle}>{site.name} • Visit {v.number}</Text><StatusBadge status={v.status} /></View><Text style={s.meta}>{ins.name} • {site.city} • {v.date}</Text><Text style={s.meta}>{v.reason} — {v.remark} • {money(site.visitCharge)}</Text>{v.status === 'PENDING_APPROVAL' ? <View style={styles.buttonRow}><SecondaryButton title="Reject" onPress={() => updateVisit(v.id, 'REJECTED')} style={styles.half} /><PrimaryButton title="Approve" onPress={() => updateVisit(v.id, 'APPROVED')} style={styles.half} /></View> : <Pressable onPress={() => navigation.navigate('VisitDetails', { visitId: v.id })}><Text style={styles.add}>View details</Text></Pressable>}</View> }) : <EmptyState text={`No ${tab.toLowerCase()} extra visit requests.`} />}</Page>; }
export function PaymentsScreen({ navigation }) { const { sites, installers, visits } = useAdminData(); return <Page><Text style={s.title}>Payments</Text><Text style={s.subtitle}>Job payments include completed normal and approved extra visits.</Text>{sites.map((site) => { const ins = installers.find((x) => x.id === site.installerId), total = getSiteTotal(site, visits); return <Pressable key={site.id} style={s.card} onPress={() => navigation.navigate('PaymentDetails', { siteId: site.id })}><View style={s.row}><Text style={s.cardTitle}>{site.name}</Text><StatusBadge status={site.paymentStatus} /></View><Text style={s.meta}>{ins.name} • {site.city}</Text><Text style={s.meta}>Installation {money(total.installation)} • Visits {money(total.normal + total.extra)}</Text><Text style={styles.total}>{money(total.total)}</Text></Pressable> })}</Page>; }
export function PaymentDetails({ route }) { const { siteId } = route.params; const { sites, installers, visits, markPaid } = useAdminData(); const site = sites.find((x) => x.id === siteId), ins = installers.find((x) => x.id === site.installerId), total = getSiteTotal(site, visits), sv = visits.filter((x) => x.siteId === siteId); return <Page><Text style={s.title}>Payment Details</Text><Text style={s.subtitle}>{site.name} • {ins.name} • {site.city}</Text><SectionHeader title="Installation Breakdown" />{site.doors.map((x) => <View key={x.type} style={[s.card, s.row]}><Text style={s.cardTitle}>{x.type} × {x.quantity}</Text><Text style={s.meta}>{money(x.charge * x.quantity)}</Text></View>)}<SectionHeader title="Visit Breakdown" /><View style={s.card}><Text style={s.meta}>Normal visits: {sv.filter((x) => x.type === 'NORMAL' && x.status === 'COMPLETED').length}</Text><Text style={s.meta}>Approved extras: {sv.filter((x) => x.status === 'APPROVED').length} • Rejected: {sv.filter((x) => x.status === 'REJECTED').length} • Pending: {sv.filter((x) => x.status === 'PENDING_APPROVAL').length}</Text></View><SectionHeader title="Financial Summary" /><View style={s.card}><Text style={s.meta}>Installation Total: {money(total.installation)}</Text><Text style={s.meta}>Normal Visit Total: {money(total.normal)}</Text><Text style={s.meta}>Approved Extra Visit Total: {money(total.extra)}</Text><Text style={styles.total}>Total Payable: {money(total.total)}</Text><StatusBadge status={site.paymentStatus} /></View>{site.paymentStatus === 'PAYMENT_PENDING' ? <PrimaryButton title="Mark as Paid" onPress={() => { markPaid(site.id); Alert.alert('Payment marked as paid', 'This demo payment is now paid.'); }} /> : null}</Page>; }
export function AssignNewSiteDropdown({ navigation }) { const { installers, cities, doorTypes, saveSite } = useAdminData(); const [form, setForm] = useState({ name: '', orderId: '', customer: '', contact: '', address: '', city: '', installerId: '', expectedVisits: '', visitCharge: '', doors: [{ type: '', quantity: '', charge: '' }], orderFile: null, status: 'ASSIGNED' }); const [errors, setErrors] = useState({}); const availableInstallers = installers.filter((item) => item.status === 'ACTIVE' && item.city === form.city); const installer = installers.find((item) => item.id === form.installerId); const usedTypes = form.doors.map((item) => item.type).filter(Boolean); const availableDoorTypes = doorTypes.filter((type) => !usedTypes.includes(type)); const installation = form.doors.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.charge || 0), 0); const visitTotal = Number(form.expectedVisits || 0) * Number(form.visitCharge || 0); const updateDoor = (index, changes) => setForm((item) => ({ ...item, doors: item.doors.map((door, i) => i === index ? { ...door, ...changes } : door) })); const chooseCity = (city) => { setForm((item) => ({ ...item, city, installerId: '', visitCharge: '', doors: item.doors.map((door) => ({ ...door, charge: '' })) })); setErrors((item) => ({ ...item, city: null, installer: null })); }; const chooseInstaller = (name) => { const selected = availableInstallers.find((item) => item.name === name); setForm((item) => ({ ...item, installerId: selected.id, visitCharge: String(selected.charges.visit), doors: item.doors.map((door) => ({ ...door, charge: door.type ? String(selected.charges[door.type]) : '' })) })); setErrors((item) => ({ ...item, installer: null })); }; const chooseDoor = (index, type) => { if (!installer) return; updateDoor(index, { type, charge: String(installer.charges[type]) }); setErrors((item) => ({ ...item, doors: null })); }; const save = () => { const nextErrors = {}; if (!form.city) nextErrors.city = 'Select a city.'; if (!form.installerId) nextErrors.installer = 'Select an installer.'; if (form.doors.some((item) => !item.type || Number(item.quantity) <= 0)) nextErrors.doors = 'Select each door type and enter a quantity.'; if (Number(form.expectedVisits) <= 0) nextErrors.visits = 'Enter expected visits.'; if (!form.name || !form.orderId || !form.customer || !form.contact || !form.address) nextErrors.details = 'Complete all site information.'; setErrors(nextErrors); if (Object.keys(nextErrors).length) { Alert.alert('Complete required fields', 'Review the highlighted assignment fields.'); return; } const saved = saveSite({ ...form, expectedVisits: Number(form.expectedVisits), visitCharge: Number(form.visitCharge), doors: form.doors.map((door) => ({ ...door, quantity: Number(door.quantity), charge: Number(door.charge) })) }); Alert.alert('Site assigned', 'Current installer rates were stored as this job’s historical snapshot.'); navigation.replace('SiteDetails', { siteId: saved.id }); }; return <Page><Text style={s.title}>Assign New Site</Text><Text style={s.subtitle}>Select a city and installer, then capture today’s rates into this job.</Text><SectionHeader title="Site Information" />{[['name', 'Site Name'], ['orderId', 'Order ID'], ['customer', 'Customer Name'], ['contact', 'Customer Contact'], ['address', 'Site Address']].map(([key, label]) => <Field key={key} label={label} value={form[key]} onChangeText={(value) => setForm((item) => ({ ...item, [key]: value }))} />)}{errors.details ? <Text style={styles.error}>{errors.details}</Text> : null}<SectionHeader title="Assignment" /><SelectField label="City" value={form.city} placeholder="Select City" options={cities} onSelect={chooseCity} error={errors.city} /><SelectField label="Installer" value={installer?.name} placeholder={form.city ? 'Select Installer' : 'Select City first'} options={availableInstallers.map((item) => item.name)} onSelect={chooseInstaller} disabled={!form.city || !availableInstallers.length} error={errors.installer} />{form.city && !availableInstallers.length ? <Text style={styles.error}>No installers available in this city.</Text> : null}{installer ? <View style={s.card}><Text style={s.cardTitle}>{installer.name}</Text><Text style={s.meta}>{installer.phone} • {installer.city}</Text><Text style={s.meta}>Current visiting charge: {money(installer.charges.visit)}</Text></View> : null}<SectionHeader title="Door Details" />{form.doors.map((door, index) => { const options = doorTypes.filter((type) => type === door.type || !usedTypes.includes(type)); return <View key={index} style={s.card}><Text style={s.cardTitle}>Door Item {index + 1}</Text><SelectField label="Door Type" value={door.type} placeholder="Select Door Type" options={options} onSelect={(type) => chooseDoor(index, type)} disabled={!installer} error={errors.doors} /><Field label="Quantity" value={String(door.quantity)} onChangeText={(quantity) => updateDoor(index, { quantity })} keyboardType="numeric" /><Field label="Installation Charge" value={String(door.charge)} onChangeText={(charge) => updateDoor(index, { charge })} keyboardType="numeric" /><Text style={styles.total}>Total: {money(Number(door.quantity || 0) * Number(door.charge || 0))}</Text>{form.doors.length > 1 ? <Pressable onPress={() => setForm((item) => ({ ...item, doors: item.doors.filter((_, i) => i !== index) }))}><Text style={styles.remove}>Remove door type</Text></Pressable> : null}</View> })}{installer && availableDoorTypes.length ? <Pressable onPress={() => setForm((item) => ({ ...item, doors: [...item.doors, { type: '', quantity: '', charge: '' }] }))}><Text style={styles.add}>+ Add Door Type</Text></Pressable> : null}<SectionHeader title="Visit Details" /><Field label="Expected Visit Count" value={String(form.expectedVisits)} onChangeText={(expectedVisits) => setForm((item) => ({ ...item, expectedVisits }))} keyboardType="numeric" />{errors.visits ? <Text style={styles.error}>{errors.visits}</Text> : null}<Field label="Visiting Charge" value={String(form.visitCharge)} onChangeText={(visitCharge) => setForm((item) => ({ ...item, visitCharge }))} keyboardType="numeric" /><SectionHeader title="Order Form" /><View style={s.card}><Pressable onPress={() => setForm((item) => ({ ...item, orderFile: item.orderFile ? 'order_form.xlsx' : 'order_form.pdf' }))}><Text style={styles.add}>{form.orderFile ? `Selected: ${form.orderFile}` : 'Upload / Select Order Form (mock)'}</Text></Pressable></View><SectionHeader title="Financial Summary" /><View style={s.card}><Text style={s.meta}>Installation Total: {money(installation)}</Text><Text style={s.meta}>Expected Visit Cost: {money(visitTotal)}</Text><Text style={styles.total}>Estimated Job Total: {money(installation + visitTotal)}</Text></View><SecondaryButton title="Cancel" onPress={() => navigation.goBack()} /><PrimaryButton title="Assign Site" onPress={save} style={styles.actionButton} /></Page>; }

const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md, marginTop: spacing.lg }, add: { ...typography.label, color: colors.primary }, field: { marginTop: spacing.md }, fieldLabel: { ...typography.label, color: colors.text, marginTop: spacing.md }, input: { height: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, marginTop: spacing.xs }, select: { minHeight: 50, marginTop: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, selectDisabled: { backgroundColor: '#EEF1F3' }, selectError: { borderColor: '#B42318' }, selectText: { ...typography.body, color: colors.text }, placeholder: { color: colors.textSecondary }, chevron: { ...typography.heading, color: colors.primary }, error: { ...typography.caption, color: '#B42318', marginTop: spacing.xs }, modalOverlay: { flex: 1, backgroundColor: 'rgba(23,33,43,0.35)', justifyContent: 'center', padding: spacing.lg }, modalCard: { backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' }, option: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, optionText: { ...typography.body, color: colors.text }, actionButton: { marginTop: spacing.sm }, remove: { ...typography.caption, color: '#B42318' }, total: { ...typography.heading, color: colors.primary, marginTop: spacing.sm }, buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, half: { flex: 1 }, logout: { color: '#B42318' } });
