const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname);

function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      filelist = walkSync(filePath, filelist);
    } else {
      filelist.push(filePath);
    }
  });
  return filelist;
}

const files = walkSync(srcDir).filter(f => f.endsWith('.js') || f.endsWith('.jsx'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  const isPage = file.includes('\\pages\\') || file.includes('/pages/');
  const isComponent = file.includes('\\components\\') || file.includes('/components/');
  const isAppJs = file.endsWith('App.js');

  if (isAppJs) {
    newContent = newContent.replace(/import '\.\/layout\.css';/g, "import './styles/layout.css';");
    newContent = newContent.replace(/import AppShell from '\.\/components\/AppShell';/g, "import AppShell from './components/layout/AppShell';");
  }

  if (isPage) {
    newContent = newContent.replace(/import AppShell from '\.\.\/components\/AppShell';/g, "import AppShell from '../components/layout/AppShell';");
    newContent = newContent.replace(/import MetricCard from '\.\.\/components\/MetricCard';/g, "import MetricBox from '../components/ui/MetricBox';");
    newContent = newContent.replace(/import SearchBar from '\.\.\/components\/SearchBar';/g, "import SearchBar from '../components/ui/SearchBar';");
    newContent = newContent.replace(/import SentimentCard from '\.\.\/components\/SentimentCard';/g, "import SentimentCard from '../components/ui/SentimentCard';");
    newContent = newContent.replace(/import StockSelector from '\.\.\/components\/StockSelector';/g, "import StockSelector from '../components/ui/StockSelector';");
    newContent = newContent.replace(/import AreaChart from '\.\.\/components\/AreaChart';/g, "import AreaChart from '../components/charts/AreaChart';");
    newContent = newContent.replace(/import CandlestickChart from '\.\.\/components\/CandlestickChart';/g, "import CandlestickChart from '../components/charts/CandlestickChart';");
    newContent = newContent.replace(/import FloatingChatbot from '\.\.\/components\/FloatingChatbot';/g, "import FloatingChatbot from '../components/ui/FloatingChatbot';");
    newContent = newContent.replace(/<MetricCard(\s|>)/g, "<MetricBox$1");
    // handle css imports
    newContent = newContent.replace(/import '\.\/([^']+)\.css';/g, "import '../styles/pages/$1.css';");
  }

  if (isComponent) {
    // for components reading from css
    newContent = newContent.replace(/import '\.\/([^']+)\.css';/g, "import '../../styles/components/$1.css';");
  }

  if (content !== newContent) {
    console.log(`Updated ${file}`);
    fs.writeFileSync(file, newContent, 'utf8');
  }
});

console.log('Refactor script completed.');
