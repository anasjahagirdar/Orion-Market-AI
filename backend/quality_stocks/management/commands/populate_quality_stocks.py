from django.core.management.base import BaseCommand

from quality_stocks.models import QualityStock, StockAIReport
from quality_stocks.services.report_generator import generate_report
from quality_stocks.services.stock_selector import select_quality_stocks


class Command(BaseCommand):
    help = 'Select quality stocks per sector and generate AI reports'

    def handle(self, *args, **options):
        self.stdout.write('Selecting quality stocks...')
        select_quality_stocks()

        stocks = QualityStock.objects.filter(is_active=True)
        total = stocks.count()
        self.stdout.write(f'Generating AI reports for {total} stocks...')

        for index, stock in enumerate(stocks, 1):
            self.stdout.write(f'  [{index}/{total}] {stock.ticker} - {stock.name}')
            generate_report(stock)

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone. {total} stocks selected, {StockAIReport.objects.count()} reports stored.'
            )
        )
