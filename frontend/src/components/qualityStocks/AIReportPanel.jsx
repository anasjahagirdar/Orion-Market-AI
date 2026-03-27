import React from 'react';
import { Box, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';

const AIReportPanel = ({ report }) => {
  if (!report?.full_report) {
    return <Typography sx={{ color: '#9aa4bf' }}>AI report is not available yet.</Typography>;
  }

  return (
    <Box
      sx={{
        color: '#e0e0e0',
        '& h2': { color: '#6E57F7', mt: 3, mb: 1 },
        '& p': { lineHeight: 1.8 },
        '& ul': { pl: 2 },
      }}
    >
      <ReactMarkdown>{report.full_report}</ReactMarkdown>
      <Typography variant="caption" sx={{ color: '#555', mt: 3, display: 'block' }}>
        Report generated: {report.generated_at ? new Date(report.generated_at).toLocaleDateString() : 'N/A'}
      </Typography>
    </Box>
  );
};

export default React.memo(AIReportPanel);
