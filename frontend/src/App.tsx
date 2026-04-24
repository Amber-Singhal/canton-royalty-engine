import React, { useState, useMemo } from 'react';
import { DamlLedger, useParty, useStreamQueries, useCommand } from '@c7/react';
import { RoyaltyAgreement, RightsDistribution, RoyaltyPayment, UsageReport } from './daml/DamlRoyalty';
import { reportUsage } from './royaltyService';
import { EarningsChart } from './EarningsChart';

import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  CssBaseline,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';

const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
  },
});

const HTTP_BASE_URL = "http://localhost:7575";
const WEBSOCKET_BASE_URL = "ws://localhost:7575";

const createToken = (party: string) => {
  const payload = {
    "https://daml.com/ledger-api": {
      "ledgerId": "sandbox",
      "applicationId": "royalty-engine",
      "actAs": [party]
    }
  };
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + btoa(JSON.stringify(payload)) + ".";
}

const LoginScreen: React.FC<{ onLogin: (party: string, token: string) => void }> = ({ onLogin }) => {
  const [partyId, setPartyId] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (partyId) {
      const token = createToken(partyId);
      onLogin(partyId, token);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <CssBaseline />
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <MonetizationOnIcon sx={{ m: 1, fontSize: 40, color: 'primary.main' }} />
        <Typography component="h1" variant="h5">
          Canton Royalty Portal
        </Typography>
        <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="partyId"
            label="Party ID"
            name="partyId"
            autoComplete="partyId"
            autoFocus
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
            helperText="e.g., Creator, Licensee, WarnerMusic, SonyMusic"
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={!partyId}
          >
            Sign In
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

const MainApp: React.FC = () => {
  const party = useParty();
  const token = useMemo(() => createToken(party), [party]);

  const { contracts: agreements, loading: agreementsLoading } = useStreamQueries(RoyaltyAgreement);
  const { contracts: distributions, loading: distributionsLoading } = useStreamQueries(RightsDistribution);
  const { contracts: payments, loading: paymentsLoading } = useStreamQueries(RoyaltyPayment);
  
  const reportUsageCmd = useCommand(UsageReport.ReportUsage);

  const [selectedAgreement, setSelectedAgreement] = useState<RoyaltyAgreement.CreateEvent | null>(null);
  const [revenue, setRevenue] = useState<string>('');
  const [reportingPeriod, setReportingPeriod] = useState<string>(new Date().toISOString().slice(0, 10));

  const selectedDistribution = useMemo(() => {
    if (!selectedAgreement) return null;
    return distributions.find(d => d.contractId === selectedAgreement.payload.distributionCid);
  }, [selectedAgreement, distributions]);

  const relevantPayments = useMemo(() => {
    if (!selectedAgreement) return [];
    return payments
      .filter(p => p.payload.agreementCid === selectedAgreement.contractId)
      .sort((a, b) => new Date(b.payload.paymentDate).getTime() - new Date(a.payload.paymentDate).getTime());
  }, [selectedAgreement, payments]);

  const handleReportUsage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAgreement || !revenue || !reportingPeriod) {
      alert("Please select an agreement and fill all fields.");
      return;
    }
    
    try {
      await reportUsage(
        token,
        selectedAgreement.payload.licensee,
        {
          agreementCid: selectedAgreement.contractId,
          reportingPeriod: new Date(reportingPeriod),
          revenue: revenue,
        },
      );
      alert('Usage reported successfully!');
      setRevenue('');
    } catch (error) {
      console.error("Failed to report usage:", error);
      alert('Failed to report usage. See console for details.');
    }
  };
  
  const isLicenseeOfSelected = selectedAgreement?.payload.licensee === party;

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <MonetizationOnIcon sx={{ mr: 2 }} />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Canton Royalty Engine
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>Logged in as:</Typography>
          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{party}</Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ mt: 10 }}>
        <Grid container spacing={3}>
          {/* Left Panel: Agreements List */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" gutterBottom>Royalty Agreements</Typography>
            <Paper>
              <List>
                {agreementsLoading && <ListItem><ListItemText primary="Loading agreements..." /></ListItem>}
                {agreements.map(agreement => (
                  <ListItem
                    button
                    key={agreement.contractId}
                    selected={selectedAgreement?.contractId === agreement.contractId}
                    onClick={() => setSelectedAgreement(agreement)}
                  >
                    <ListItemText
                      primary={agreement.payload.contentId}
                      secondary={`Licensee: ${agreement.payload.licensee}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
          
          {/* Right Panel: Details and Actions */}
          <Grid item xs={12} md={8}>
            {!selectedAgreement ? (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6">Select an agreement to view details</Typography>
              </Paper>
            ) : (
              <Grid container spacing={3}>
                {/* Distribution Details */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Rights Distribution for "{selectedAgreement.payload.contentId}"</Typography>
                      {distributionsLoading ? <Typography>Loading...</Typography> :
                        !selectedDistribution ? <Typography>Distribution not found.</Typography> :
                          <TableContainer component={Paper}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Rights Holder</TableCell>
                                  <TableCell align="right">Share (%)</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {Array.from(selectedDistribution.payload.shares.entries()).map(([holder, share]) => (
                                  <TableRow key={holder}>
                                    <TableCell component="th" scope="row">{holder}</TableCell>
                                    <TableCell align="right">{(parseFloat(share) * 100).toFixed(2)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                      }
                    </CardContent>
                  </Card>
                </Grid>

                {/* Report Usage Form (for Licensee) */}
                {isLicenseeOfSelected && (
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>Report Usage</Typography>
                        <Box component="form" onSubmit={handleReportUsage} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <TextField
                            label="Revenue"
                            type="number"
                            value={revenue}
                            onChange={e => setRevenue(e.target.value)}
                            required
                            size="small"
                          />
                          <TextField
                            label="Reporting Period"
                            type="date"
                            value={reportingPeriod}
                            onChange={e => setReportingPeriod(e.target.value)}
                            required
                            size="small"
                            InputLabelProps={{ shrink: true }}
                          />
                          <Button type="submit" variant="contained">Submit</Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
                
                {/* Earnings Chart */}
                <Grid item xs={12}>
                   <Card>
                     <CardContent>
                        <Typography variant="h6" gutterBottom>Royalty Earnings Over Time</Typography>
                        <EarningsChart paymentData={relevantPayments} party={party} />
                     </CardContent>
                   </Card>
                </Grid>

                {/* Payment History */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Payment History</Typography>
                      {paymentsLoading ? <Typography>Loading...</Typography> :
                        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                          <Table stickyHeader size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Payment Date</TableCell>
                                <TableCell>Payer</TableCell>
                                <TableCell>Payee</TableCell>
                                <TableCell align="right">Amount</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {relevantPayments.map(p => (
                                <TableRow key={p.contractId}>
                                  <TableCell>{new Date(p.payload.paymentDate).toLocaleDateString()}</TableCell>
                                  <TableCell>{p.payload.payer}</TableCell>
                                  <TableCell>{p.payload.payee}</TableCell>
                                  <TableCell align="right">{parseFloat(p.payload.amount).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      }
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

const App: React.FC = () => {
  const [credentials, setCredentials] = useState<{ party: string; token: string } | null>(null);

  if (!credentials) {
    return (
      <ThemeProvider theme={theme}>
        <LoginScreen onLogin={(party, token) => setCredentials({ party, token })} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <DamlLedger
        party={credentials.party}
        token={credentials.token}
        httpBaseUrl={HTTP_BASE_URL}
        wsBaseUrl={WEBSOCKET_BASE_URL}
      >
        <MainApp />
      </DamlLedger>
    </ThemeProvider>
  );
};

export default App;