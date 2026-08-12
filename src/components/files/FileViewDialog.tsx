import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { supabase } from '../../lib/supabase';
import type { PhysicalFile, FileMovement } from '../../types';
import StatusChip from '../common/StatusChip';
import { format, isPast } from 'date-fns';

interface FileViewDialogProps {
  open: boolean;
  fileId: string | null;
  onClose: () => void;
}

function InfoCard({ label, value }: { label: string; value?: string | null }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-word' }}>
        {value || '-'}
      </Typography>
    </Paper>
  );
}

export default function FileViewDialog({ open, fileId, onClose }: FileViewDialogProps) {
  const [file, setFile] = useState<PhysicalFile | null>(null);
  const [movements, setMovements] = useState<FileMovement[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    const [fileRes, movRes] = await Promise.all([
      supabase
        .from('physical_files')
        .select('*, client:clients(client_name,client_id), cabinet:cabinets(cabinet_name,cabinet_number), current_holder:employees(full_name)')
        .eq('id', fileId)
        .maybeSingle(),
      supabase
        .from('file_movements')
        .select('*, taken_by:employees(full_name), received_by:employees(full_name), returned_by:employees(full_name)')
        .eq('file_id', fileId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
    ]);
    setFile(fileRes.data as PhysicalFile | null);
    setMovements((movRes.data as FileMovement[]) ?? []);
    setLoading(false);
  }, [fileId]);

  useEffect(() => {
    if (open && fileId) loadData();
  }, [open, fileId, loadData]);

  const cabinetLabel = (() => {
    const cab = file?.cabinet as { cabinet_name: string; cabinet_number?: string } | undefined;
    if (!cab) return null;
    if (cab.cabinet_number) return `Cabinet ${cab.cabinet_number}`;
    return cab.cabinet_name;
  })();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={false}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" fontWeight={700}>{file?.file_name ?? 'File Details'}</Typography>
          {file && <Chip label={file.file_id} size="small" color="primary" />}
          {file && <StatusChip status={file.status} />}
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
        ) : !file ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">File not found.</Typography>
          </Box>
        ) : (
          <Box>
            {/* FILE INFORMATION */}
            <Typography variant="subtitle2" color="primary.main" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
              File Information
            </Typography>
            <Grid container spacing={1.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><InfoCard label="File ID" value={file.file_id} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><InfoCard label="File Name" value={file.file_name} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><InfoCard label="File Number" value={file.file_number} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><InfoCard label="File Subject" value={file.file_subject} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <InfoCard label="Client" value={(file.client as { client_name: string } | undefined)?.client_name} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><InfoCard label="Assessment Year" value={file.assessment_year} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><InfoCard label="Financial Year" value={file.financial_year} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                  <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>Status</Typography>
                  <Box sx={{ mt: 0.5 }}><StatusChip status={file.status} /></Box>
                </Paper>
              </Grid>
            </Grid>

            {/* PHYSICAL LOCATION */}
            <Typography variant="subtitle2" color="primary.main" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
              Physical Location
            </Typography>
            <Grid container spacing={1.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <InfoCard label="Cabinet" value={cabinetLabel ?? 'Cabinet Not Assigned'} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><InfoCard label="Shelf" value={file.shelf} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><InfoCard label="Drawer" value={file.drawer} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><InfoCard label="Rack" value={file.rack} /></Grid>
            </Grid>

            {/* CURRENT STATUS */}
            <Typography variant="subtitle2" color="primary.main" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
              Current Status
            </Typography>
            <Grid container spacing={1.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <InfoCard label="Current Holder" value={(file.current_holder as { full_name: string } | undefined)?.full_name ?? 'In office'} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <InfoCard label="Last Moved" value={file.last_movement_date ? format(new Date(file.last_movement_date), 'dd MMM yyyy HH:mm') : 'Never'} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <InfoCard label="Created Date" value={format(new Date(file.created_at), 'dd MMM yyyy HH:mm')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <InfoCard label="Updated Date" value={format(new Date(file.updated_at), 'dd MMM yyyy HH:mm')} />
              </Grid>
            </Grid>

            {/* REMARKS */}
            {file.remarks && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="primary.main" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
                  Remarks
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="body2">{file.remarks}</Typography>
                </Paper>
              </Box>
            )}

            {/* MOVEMENT HISTORY */}
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" color="primary.main" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
              <SwapHorizIcon fontSize="small" /> Movement History ({movements.length})
            </Typography>
            {movements.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <SwapHorizIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 0.5 }} />
                <Typography color="text.secondary" variant="body2">No movement history for this file.</Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 700 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Movement ID</TableCell>
                      <TableCell>Taken By</TableCell>
                      <TableCell>Taken Date</TableCell>
                      <TableCell>Expected Return</TableCell>
                      <TableCell>Returned Date</TableCell>
                      <TableCell>Received By</TableCell>
                      <TableCell>Purpose</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {movements.map(m => {
                      const isOverdue = m.status === 'out' && m.expected_return_date && isPast(new Date(m.expected_return_date));
                      return (
                        <TableRow key={m.id} hover sx={{ bgcolor: isOverdue ? 'error.50' : undefined }}>
                          <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{m.movement_id}</Typography></TableCell>
                          <TableCell>{(m.taken_by as { full_name: string } | undefined)?.full_name ?? '-'}</TableCell>
                          <TableCell>{format(new Date(m.taken_date), 'dd MMM yy HH:mm')}</TableCell>
                          <TableCell>{m.expected_return_date ? <Chip label={format(new Date(m.expected_return_date), 'dd MMM yy')} size="small" color={isOverdue ? 'error' : 'default'} /> : '-'}</TableCell>
                          <TableCell>{m.returned_date ? format(new Date(m.returned_date), 'dd MMM yy HH:mm') : '-'}</TableCell>
                          <TableCell>{(m.received_by as { full_name: string } | undefined)?.full_name ?? '-'}</TableCell>
                          <TableCell><Typography variant="caption">{m.purpose ?? '-'}</Typography></TableCell>
                          <TableCell>
                            {m.status === 'returned' ? (
                              <Chip icon={<CheckCircleIcon />} label="Returned" size="small" color="success" />
                            ) : isOverdue ? (
                              <Chip label="Overdue" size="small" color="error" />
                            ) : (
                              <Chip label="Out" size="small" color="warning" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
