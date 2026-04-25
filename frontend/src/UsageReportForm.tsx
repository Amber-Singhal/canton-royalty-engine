import React, { useState } from 'react';
import { useLedger } from '@c7/react';
import { ContractId } from '@c7/core';
import { Agreement } from '@canton-royalty-engine/daml-codegen/dist/Royalty/Model/Agreement'; // Assuming codegen is setup

interface UsageReportFormProps {
  agreementCid: ContractId<Agreement>;
  onSuccess: () => void; // Callback to inform parent component of successful submission
}

const formStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  padding: '1.5rem',
  border: '1px solid #ccc',
  borderRadius: '8px',
  backgroundColor: '#f9f9f9',
  maxWidth: '500px',
  margin: '1rem auto',
};

const inputGroupStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const labelStyles: React.CSSProperties = {
  fontWeight: 'bold',
  fontSize: '0.9rem',
  color: '#333',
};

const inputStyles: React.CSSProperties = {
  padding: '0.75rem',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '1rem',
};

const buttonStyles: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  border: 'none',
  borderRadius: '4px',
  backgroundColor: '#007bff',
  color: 'white',
  fontSize: '1rem',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
};

const disabledButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: '#aaa',
  cursor: 'not-allowed',
};

const errorStyles: React.CSSProperties = {
  color: 'red',
  marginTop: '0.5rem',
  padding: '0.5rem',
  backgroundColor: '#fdd',
  border: '1px solid red',
  borderRadius: '4px',
};

const UsageReportForm: React.FC<UsageReportFormProps> = ({ agreementCid, onSuccess }) => {
  const ledger = useLedger();

  const [reportId, setReportId] = useState(`report-${Date.now()}`);
  const [usageDate, setUsageDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [unitsSold, setUnitsSold] = useState('');
  const [revenue, setRevenue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!reportId || !usageDate || !unitsSold || !revenue) {
      setError("All fields are required.");
      return;
    }

    const parsedUnits = parseInt(unitsSold, 10);
    if (isNaN(parsedUnits) || parsedUnits < 0) {
      setError("Units sold must be a non-negative number.");
      return;
    }

    const parsedRevenue = parseFloat(revenue);
    if (isNaN(parsedRevenue) || parsedRevenue < 0) {
      setError("Revenue must be a non-negative number.");
      return;
    }

    setIsSubmitting(true);

    try {
      // The `exercise` command interacts with the Daml ledger.
      // It specifies which choice to exercise on which contract,
      // and provides the necessary arguments for that choice.
      await ledger.exercise(Agreement.ReportUsage, agreementCid, {
        reportId,
        usageDate,
        unitsSold: parsedUnits.toString(), // Daml's Int is represented as a string in JSON
        revenue: parsedRevenue.toFixed(10), // Daml Decimals require string representation
      });

      // Reset form on success and notify parent
      setReportId(`report-${Date.now()}`);
      setUnitsSold('');
      setRevenue('');
      onSuccess();

    } catch (err) {
      console.error("Failed to submit usage report:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Failed to submit report: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form style={formStyles} onSubmit={handleSubmit}>
      <h3>Submit Usage Report</h3>
      <p>Reporting for Agreement: <code>{agreementCid}</code></p>

      <div style={inputGroupStyles}>
        <label htmlFor="reportId" style={labelStyles}>Report ID</label>
        <input
          id="reportId"
          type="text"
          style={inputStyles}
          value={reportId}
          onChange={(e) => setReportId(e.target.value)}
          required
        />
      </div>

      <div style={inputGroupStyles}>
        <label htmlFor="usageDate" style={labelStyles}>Usage Date</label>
        <input
          id="usageDate"
          type="date"
          style={inputStyles}
          value={usageDate}
          onChange={(e) => setUsageDate(e.target.value)}
          required
        />
      </div>

      <div style={inputGroupStyles}>
        <label htmlFor="unitsSold" style={labelStyles}>Units Sold / Streams</label>
        <input
          id="unitsSold"
          type="number"
          min="0"
          step="1"
          style={inputStyles}
          placeholder="e.g., 1000"
          value={unitsSold}
          onChange={(e) => setUnitsSold(e.target.value)}
          required
        />
      </div>

      <div style={inputGroupStyles}>
        <label htmlFor="revenue" style={labelStyles}>Total Revenue (USD)</label>
        <input
          id="revenue"
          type="number"
          min="0"
          step="0.01"
          style={inputStyles}
          placeholder="e.g., 2500.50"
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
          required
        />
      </div>

      {error && <div style={errorStyles}>{error}</div>}

      <button
        type="submit"
        style={isSubmitting ? disabledButtonStyles : buttonStyles}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Report'}
      </button>
    </form>
  );
};

export default UsageReportForm;