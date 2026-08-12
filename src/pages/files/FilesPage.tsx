import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import VisibilityIcon from '@mui/icons-material/Visibility';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Fab from '@mui/material/Fab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { supabase } from '../../lib/supabase';
import type { PhysicalFile, Cabinet, Client, Employee } from '../../types';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../lib/audit';
import { format } from 'date-fns';
import FileViewDialog from '../../components/files/FileViewDialog';

const STATUS_OPTIONS = ['all', 'available', 'in_use', 'sent_outside', 'archived', 'missing'];

const AY_OPTIONS = [
  '2023-24', '2024-25', '2025-26', '2026-27', '2027-28', '2028-29', '2029-30',
];

const FY_OPTIONS = [
  '2022-23', '2023-24', '2024-25', '2025-26', '2026-27', '2027-28', '2028-29',
];

const defaultForm = {
  file_number: '', file_name: '', file_subject: '', client_id: '',
  assessment_year: '', financial_year: '',
  cabinet_id: '', shelf: '', drawer: '', rack: '',
  current_holder_id: '', status: 'available', remarks: '',
};

export default function FilesPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [files, setFiles] = useState<PhysicalFile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [ayFilter, setAyFilter] = useState('all');
  const [fyFilter, setFyFilter] = useState('all');
  const [cabinetFilter, setCabinetFilter] = useState('all');
  const [holderFilter, setHolderFilter] = useState('all');
  const [shelfFilter, setShelfFilter] = useState('all');
  const [drawerFilter, setDrawerFilter] = useState('all');
  const [rackFilter, setRackFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editFile, setEditFile] = useState<PhysicalFile | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; file: PhysicalFile | null }>({ open: false, file: null });
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [viewFileId, setViewFileId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const loadFiles = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('physical_files')
      .select('*, client:clients(client_name,client_id), cabinet:cabinets(cabinet_name,cabinet_number), current_holder:employees(full_name)', { count: 'exact' })
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (clientFilter !== 'all') query = query.eq('client_id', clientFilter);
    if (ayFilter !== 'all') query = query.eq('assessment_year', ayFilter);
    if (fyFilter !== 'all') query = query.eq('financial_year', fyFilter);
    if (cabinetFilter !== 'all') query = query.eq('cabinet_id', cabinetFilter);
    if (holderFilter !== 'all') query = query.eq('current_holder_id', holderFilter);
    if (search) query = query.or(`file_name.ilike.%${search}%,file_id.ilike.%${search}%,file_number.ilike.%${search}%`);
    if (subjectSearch) query = query.ilike('file_subject', `%${subjectSearch}%`);
    if (shelfFilter !== 'all') query = query.eq('shelf', shelfFilter);
    if (drawerFilter !== 'all') query = query.eq('drawer', drawerFilter);
    if (rackFilter !== 'all') query = query.eq('rack', rackFilter);
    const { data, count } = await query;
    setFiles((data as PhysicalFile[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, rowsPerPage, search, subjectSearch, statusFilter, clientFilter, ayFilter, fyFilter, cabinetFilter, holderFilter, shelfFilter, drawerFilter, rackFilter]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  useEffect(() => {
    supabase.from('cabinets').select('*').eq('is_deleted', false).order('cabinet_name').then(r => setCabinets(r.data ?? []));
    supabase.from('clients').select('id, client_name, client_id').eq('is_deleted', false).eq('status', 'active').order('client_name').then(r => setClients((r.data ?? []) as Client[]));
    supabase.from('employees').select('*').eq('status', 'active').order('full_name').then(r => setEmployees(r.data ?? []));
  }, []);

  function openEdit(file: PhysicalFile | null) {
    setEditFile(file);
    if (file) {
      setForm({
        file_number: file.file_number, file_name: file.file_name,
        file_subject: file.file_subject ?? '',
        client_id: file.client_id ?? '', cabinet_id: file.cabinet_id ?? '',
        shelf: file.shelf ?? '', drawer: file.drawer ?? '', rack: file.rack ?? '',
        current_holder_id: file.current_holder_id ?? '', status: file.status, remarks: file.remarks ?? '',
        assessment_year: file.assessment_year ?? '', financial_year: file.financial_year ?? '',
      });
    } else {
      setForm(defaultForm);
    }
    setError('');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.file_name.trim()) { setError('File name is required.'); return; }
    if (!form.cabinet_id) { setError('Cabinet selection is required.'); return; }
    if (form.file_subject && form.file_subject.trim().length > 200) { setError('File Subject must be 200 characters or fewer.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        file_subject: form.file_subject.trim() || null,
        assessment_year: form.assessment_year || null,
        financial_year: form.financial_year || null,
        client_id: form.client_id || null,
        cabinet_id: form.cabinet_id || null,
        current_holder_id: form.current_holder_id || null,
      };
      if (editFile) {
        const { error: updateError } = await supabase.from('physical_files').update({ ...payload, updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', editFile.id);
        if (updateError) throw updateError;
        await logAudit({ action: 'UPDATE', module: 'files', record_id: editFile.id, record_display: form.file_name }, user?.id, profile?.full_name);
      } else {
        const fileId = `FL${Date.now().toString().slice(-6)}`;
        const { data, error: insertError } = await supabase.from('physical_files').insert({ ...payload, file_id: fileId, created_by: user?.id, updated_by: user?.id }).select().single();
        if (insertError) throw insertError;
        await logAudit({ action: 'CREATE', module: 'files', record_id: (data as PhysicalFile)?.id, record_display: form.file_name }, user?.id, profile?.full_name);
      }
      setDialogOpen(false);
      loadFiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(reason?: string) {
    if (!deleteDialog.file) return;
    await supabase.from('physical_files').update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user?.id, delete_reason: reason }).eq('id', deleteDialog.file.id);
    await logAudit({ action: 'DELETE', module: 'files', record_id: deleteDialog.file.id, record_display: deleteDialog.file.file_name, notes: reason }, user?.id, profile?.full_name);
    setDeleteDialog({ open: false, file: null });
    loadFiles();
  }

  function clearFilters() {
    setSearch('');
    setSubjectSearch('');
    setStatusFilter('all');
    setClientFilter('all');
    setAyFilter('all');
    setFyFilter('all');
    setCabinetFilter('all');
    setHolderFilter('all');
    setShelfFilter('all');
    setDrawerFilter('all');
    setRackFilter('all');
    setPage(0);
  }

  const hasActiveFilters = search || subjectSearch || statusFilter !== 'all' || clientFilter !== 'all' || ayFilter !== 'all' || fyFilter !== 'all' || cabinetFilter !== 'all' || holderFilter !== 'all' || shelfFilter !== 'all' || drawerFilter !== 'all' || rackFilter !== 'all';

  return (
    <Box sx={{ pb: { xs: 10, md: 0 } }}>
      <PageHeader
        title="Physical File Master"
        subtitle={`${total} files`}
        action={!isMobile && canEdit ? <Button startIcon={<AddIcon />} variant="contained" onClick={() => openEdit(null)}>Add File</Button> : undefined}
      />

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row', md: 'column' }} spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField
              placeholder="Search file name / number..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
            <TextField
              placeholder="Search subject..."
              value={subjectSearch} onChange={e => { setSubjectSearch(e.target.value); setPage(0); }}
              size="small" sx={{ minWidth: { xs: '100%', sm: 180 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(0); }} size="small" label="Client" sx={{ minWidth: 150 }}>
              <MenuItem value="all">All Clients</MenuItem>
              {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.client_name}</MenuItem>)}
            </TextField>
            <TextField select value={ayFilter} onChange={e => { setAyFilter(e.target.value); setPage(0); }} size="small" label="AY" sx={{ minWidth: 110 }}>
              <MenuItem value="all">All AY</MenuItem>
              {AY_OPTIONS.map(ay => <MenuItem key={ay} value={ay}>{ay}</MenuItem>)}
            </TextField>
            <TextField select value={fyFilter} onChange={e => { setFyFilter(e.target.value); setPage(0); }} size="small" label="FY" sx={{ minWidth: 110 }}>
              <MenuItem value="all">All FY</MenuItem>
              {FY_OPTIONS.map(fy => <MenuItem key={fy} value={fy}>{fy}</MenuItem>)}
            </TextField>
            <TextField select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} size="small" label="Status" sx={{ minWidth: 130 }}>
              {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s === 'all' ? 'All Status' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>)}
            </TextField>
            <TextField select value={cabinetFilter} onChange={e => { setCabinetFilter(e.target.value); setPage(0); }} size="small" label="Cabinet" sx={{ minWidth: 140 }}>
              <MenuItem value="all">All Cabinets</MenuItem>
              {cabinets.map(c => <MenuItem key={c.id} value={c.id}>{c.cabinet_number ? `Cabinet ${c.cabinet_number}` : c.cabinet_name}</MenuItem>)}
            </TextField>
            <TextField select value={holderFilter} onChange={e => { setHolderFilter(e.target.value); setPage(0); }} size="small" label="Holder" sx={{ minWidth: 140 }}>
              <MenuItem value="all">All Holders</MenuItem>
              {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
            </TextField>
            <TextField value={shelfFilter === 'all' ? '' : shelfFilter} onChange={e => { setShelfFilter(e.target.value || 'all'); setPage(0); }} size="small" label="Shelf" sx={{ minWidth: 100 }} placeholder="All" />
            <TextField value={drawerFilter === 'all' ? '' : drawerFilter} onChange={e => { setDrawerFilter(e.target.value || 'all'); setPage(0); }} size="small" label="Drawer" sx={{ minWidth: 100 }} placeholder="All" />
            <TextField value={rackFilter === 'all' ? '' : rackFilter} onChange={e => { setRackFilter(e.target.value || 'all'); setPage(0); }} size="small" label="Rack" sx={{ minWidth: 100 }} placeholder="All" />
            </TextField>
            {hasActiveFilters && (
              <Button startIcon={<ClearIcon />} onClick={clearFilters} size="small" sx={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>Clear Filters</Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {isMobile ? (
        <Box>
          {loading ? <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
            : files.length === 0 ? <Paper sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No files found</Typography></Paper>
            : files.map(f => (
              <Card key={f.id} sx={{ mb: 1.5, cursor: 'pointer', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 } }} onClick={() => navigate(`/files/${f.id}`)}>
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="caption" color="primary.main" fontWeight={700}>{f.file_id}</Typography>
                    <StatusChip status={f.status} />
                  </Box>
                  <Typography variant="subtitle2" fontWeight={600}>{f.file_name}</Typography>
                  {f.file_number && <Typography variant="caption" color="text.secondary">#{f.file_number}</Typography>}
                  {f.file_subject && <Typography variant="caption" color="text.secondary" display="block">{f.file_subject}</Typography>}
                  <Typography variant="caption" color="text.secondary" display="block">
                    {(f.client as { client_name: string } | undefined)?.client_name ?? '-'}
                    {f.assessment_year ? ` · AY ${f.assessment_year}` : ''}
                    {f.financial_year ? ` · FY ${f.financial_year}` : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{(f.cabinet as { cabinet_name: string; cabinet_number?: string } | undefined) ? ((f.cabinet as { cabinet_number?: string }).cabinet_number ? `Cabinet ${(f.cabinet as { cabinet_number?: string }).cabinet_number}` : (f.cabinet as { cabinet_name: string }).cabinet_name) : '-'}{f.shelf ? ` / Shelf ${f.shelf}` : ''}</Typography>
                </CardContent>
                <CardActions onClick={(e) => e.stopPropagation()}>
                  <IconButton size="small" onClick={() => { setViewFileId(f.id); setViewOpen(true); }}><VisibilityIcon fontSize="small" /></IconButton>
                  {canEdit && (
                    <>
                      <IconButton size="small" onClick={() => openEdit(f)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, file: f })}><DeleteIcon fontSize="small" /></IconButton>
                    </>
                  )}
                </CardActions>
              </Card>
            ))}
          {total > rowsPerPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, py: 2 }}>
              <Button disabled={page === 0} onClick={() => setPage(p => p - 1)} size="small">Prev</Button>
              <Typography variant="body2" sx={{ my: 'auto' }}>{page + 1} / {Math.ceil(total / rowsPerPage)}</Typography>
              <Button disabled={(page + 1) * rowsPerPage >= total} onClick={() => setPage(p => p + 1)} size="small">Next</Button>
            </Box>
          )}
        </Box>
      ) : (
      <Paper>
        <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 1100 }}>
          <TableHead>
            <TableRow>
              <TableCell>File ID</TableCell>
              <TableCell>File Name</TableCell>
              <TableCell>File Number</TableCell>
              <TableCell>File Subject</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>AY</TableCell>
              <TableCell>FY</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Cabinet</TableCell>
              <TableCell>Shelf</TableCell>
              <TableCell>Current Holder</TableCell>
              <TableCell>Last Moved</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={13} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              : files.length === 0 ? <TableRow><TableCell colSpan={13} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No files found</Typography></TableCell></TableRow>
              : files.map(f => (
                <TableRow key={f.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/files/${f.id}`)}>
                  <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{f.file_id}</Typography></TableCell>
                  <TableCell><Typography variant="body2" fontWeight={500}>{f.file_name}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.file_number || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.file_subject || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{(f.client as { client_name: string } | undefined)?.client_name ?? '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.assessment_year || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.financial_year || '-'}</Typography></TableCell>
                  <TableCell><StatusChip status={f.status} /></TableCell>
                  <TableCell><Typography variant="body2">{(f.cabinet as { cabinet_name: string; cabinet_number?: string } | undefined) ? ((f.cabinet as { cabinet_number?: string }).cabinet_number ? `Cabinet ${(f.cabinet as { cabinet_number?: string }).cabinet_number}` : (f.cabinet as { cabinet_name: string }).cabinet_name) : '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.shelf || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{(f.current_holder as { full_name: string } | undefined)?.full_name ?? '-'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{f.last_movement_date ? format(new Date(f.last_movement_date), 'dd MMM yy') : '-'}</Typography></TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="View"><IconButton size="small" onClick={() => { setViewFileId(f.id); setViewOpen(true); }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                    {canEdit && (
                      <>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(f)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, file: f })}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        </Box>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} />
      </Paper>
      )}

      {isMobile && canEdit && <Fab color="primary" onClick={() => openEdit(null)} sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1200 }}><AddIcon /></Fab>}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editFile ? 'Edit File' : 'Add New File'}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="File Name *" value={form.file_name} onChange={e => setForm(p => ({ ...p, file_name: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="File Number" value={form.file_number} onChange={e => setForm(p => ({ ...p, file_number: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="File Subject" value={form.file_subject} onChange={e => setForm(p => ({ ...p, file_subject: e.target.value }))} fullWidth size="small" inputProps={{ maxLength: 200 }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                options={clients}
                getOptionLabel={c => `${c.client_id} - ${c.client_name}`}
                value={clients.find(c => c.id === form.client_id) ?? null}
                onChange={(_, v) => setForm(p => ({ ...p, client_id: v?.id ?? '' }))}
                renderInput={params => <TextField {...params} label="Client" size="small" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="AY" value={form.assessment_year} onChange={e => setForm(p => ({ ...p, assessment_year: e.target.value }))} fullWidth size="small">
                <MenuItem value="">-- None --</MenuItem>
                {AY_OPTIONS.map(ay => <MenuItem key={ay} value={ay}>{ay}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="FY" value={form.financial_year} onChange={e => setForm(p => ({ ...p, financial_year: e.target.value }))} fullWidth size="small">
                <MenuItem value="">-- None --</MenuItem>
                {FY_OPTIONS.map(fy => <MenuItem key={fy} value={fy}>{fy}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} fullWidth size="small">
                {STATUS_OPTIONS.filter(s => s !== 'all').map(s => <MenuItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Cabinet *" value={form.cabinet_id} onChange={e => setForm(p => ({ ...p, cabinet_id: e.target.value }))} fullWidth size="small" required error={!form.cabinet_id && !!error}>
                <MenuItem value="">-- Select Cabinet --</MenuItem>
                {cabinets.map(c => <MenuItem key={c.id} value={c.id}>{c.cabinet_number ? `Cabinet ${c.cabinet_number}` : c.cabinet_name}{c.cabinet_name && c.cabinet_number && c.cabinet_name !== `Cabinet ${c.cabinet_number}` ? ` — ${c.cabinet_name}` : ''}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={4}>
              <TextField label="Shelf" value={form.shelf} onChange={e => setForm(p => ({ ...p, shelf: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid size={4}>
              <TextField label="Drawer" value={form.drawer} onChange={e => setForm(p => ({ ...p, drawer: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid size={4}>
              <TextField label="Rack" value={form.rack} onChange={e => setForm(p => ({ ...p, rack: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Current Holder" value={form.current_holder_id} onChange={e => setForm(p => ({ ...p, current_holder_id: e.target.value }))} fullWidth size="small">
                <MenuItem value="">-- None --</MenuItem>
                {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField label="Remarks" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} fullWidth size="small" multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {editFile ? 'Save' : 'Add File'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete File"
        message={`Delete file "${deleteDialog.file?.file_name}"? It will be moved to the Recycle Bin.`}
        requireReason
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, file: null })}
      />

      <FileViewDialog open={viewOpen} fileId={viewFileId} onClose={() => setViewOpen(false)} />
    </Box>
  );
}
