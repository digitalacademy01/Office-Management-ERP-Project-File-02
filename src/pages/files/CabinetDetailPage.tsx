import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { supabase } from '../../lib/supabase';
import type { Cabinet, PhysicalFile } from '../../types';
import StatusChip from '../../components/common/StatusChip';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const STATUS_OPTIONS = ['all', 'available', 'in_use', 'sent_outside', 'archived', 'missing'];

export default function CabinetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [cabinet, setCabinet] = useState<Cabinet | null>(null);
  const [files, setFiles] = useState<PhysicalFile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [cabRes, filesRes] = await Promise.all([
      supabase.from('cabinets').select('*').eq('id', id).maybeSingle(),
      supabase.from('physical_files')
        .select('*, client:clients(client_name,client_id)', { count: 'exact' })
        .eq('cabinet_id', id)
        .eq('is_deleted', false)
        .order('file_name')
        .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1),
    ]);
    setCabinet(cabRes.data as Cabinet | null);
    let filtered = (filesRes.data as PhysicalFile[]) ?? [];
    if (statusFilter !== 'all') filtered = filtered.filter(f => f.status === statusFilter);
    if (search) filtered = filtered.filter(f =>
      f.file_name.toLowerCase().includes(search.toLowerCase()) ||
      f.file_id.toLowerCase().includes(search.toLowerCase()) ||
      f.file_number?.toLowerCase().includes(search.toLowerCase())
    );
    setFiles(filtered);
    setTotal(filesRes.count ?? 0);
    setLoading(false);
  }, [id, page, rowsPerPage, statusFilter, search]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleExport() {
    const rows = files.map(f => ({
      'File ID': f.file_id,
      'File Name': f.file_name,
      'File Number': f.file_number ?? '',
      'Client': (f.client as { client_name: string } | undefined)?.client_name ?? '',
      'Shelf': f.shelf ?? '',
      'Drawer': f.drawer ?? '',
      'Status': f.status,
      'Last Movement': f.last_movement_date ? format(new Date(f.last_movement_date), 'dd MMM yyyy') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Files');
    XLSX.writeFile(wb, `cabinet_${cabinet?.cabinet_name ?? 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  if (loading && !cabinet) {
    return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;
  }

  if (!cabinet) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/cabinets')}>Back to Cabinets</Button>
        <Paper sx={{ p: 4, textAlign: 'center', mt: 2 }}>
          <Typography color="text.secondary">Cabinet not found.</Typography>
        </Paper>
      </Box>
    );
  }

  const occupancy = cabinet.capacity > 0 ? Math.min(total / cabinet.capacity * 100, 100) : 0;

  return (
    <Box sx={{ pb: { xs: 10, md: 0 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/cabinets')} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h5" fontWeight={700} color="primary.main" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
          {cabinet.cabinet_name}
        </Typography>
        {cabinet.cabinet_number && <Chip label={`#${cabinet.cabinet_number}`} size="small" />}
        <StatusChip status={cabinet.status} />
      </Box>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary">Occupancy ({total}/{cabinet.capacity})</Typography>
            <LinearProgress
              variant="determinate"
              value={occupancy}
              color={occupancy > 90 ? 'error' : occupancy > 70 ? 'warning' : 'primary'}
              sx={{ mt: 0.5 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`${cabinet.num_shelves} shelves`} size="small" />
            {cabinet.num_drawers > 0 && <Chip label={`${cabinet.num_drawers} drawers`} size="small" />}
          </Box>
          <Button startIcon={<FileDownloadIcon />} variant="outlined" size="small" onClick={handleExport}>
            Export
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            placeholder="Search file name, ID..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            size="small" fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <TextField
            select value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            size="small" label="Status"
            sx={{ minWidth: 130 }}
          >
            {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s === 'all' ? 'All Status' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>

      {isMobile ? (
        <Box>
          {loading ? <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
            : files.length === 0 ? <Paper sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No files in this cabinet</Typography></Paper>
            : files.map(f => (
              <Card key={f.id} sx={{ mb: 1.5 }}>
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="caption" color="primary.main" fontWeight={700}>{f.file_id}</Typography>
                    <StatusChip status={f.status} />
                  </Box>
                  <Typography variant="subtitle2" fontWeight={600}>{f.file_name}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {(f.client as { client_name: string } | undefined)?.client_name ?? '-'}
                  </Typography>
                  {f.shelf && <Typography variant="caption" color="text.secondary">Shelf {f.shelf}</Typography>}
                </CardContent>
                <CardActions sx={{ pt: 0, px: 2, pb: 1 }}>
                  <IconButton size="small" onClick={() => navigate(`/files/${f.id}`)}><VisibilityIcon fontSize="small" /></IconButton>
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
            <Table size="small" sx={{ minWidth: 700 }}>
              <TableHead>
                <TableRow>
                  <TableCell>File ID</TableCell>
                  <TableCell>File Name</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Shelf</TableCell>
                  <TableCell>Drawer</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Moved</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
                  : files.length === 0 ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No files in this cabinet</Typography></TableCell></TableRow>
                  : files.map(f => (
                    <TableRow key={f.id} hover>
                      <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{f.file_id}</Typography></TableCell>
                      <TableCell><Typography variant="body2" fontWeight={500}>{f.file_name}</Typography></TableCell>
                      <TableCell>{(f.client as { client_name: string } | undefined)?.client_name ?? '-'}</TableCell>
                      <TableCell>{f.shelf ?? '-'}</TableCell>
                      <TableCell>{f.drawer ?? '-'}</TableCell>
                      <TableCell><StatusChip status={f.status} /></TableCell>
                      <TableCell>{f.last_movement_date ? format(new Date(f.last_movement_date), 'dd MMM yy') : '-'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => navigate(`/files/${f.id}`)}><VisibilityIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Box>
          <TablePagination
            component="div" count={total} page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>
      )}
    </Box>
  );
}
