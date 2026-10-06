import { Component, Inject, OnInit } from '@angular/core';
import { I18NEXT_SERVICE, ITranslationService } from 'angular-i18next';

declare let alertify: any;

@Component({
  selector: 'app-root',
  standalone: false,
  template: `<router-outlet></router-outlet>`,
})
export class AppComponent implements OnInit {
  constructor(@Inject(I18NEXT_SERVICE) private i18n: ITranslationService) {}

  ngOnInit(): void {
    // Override alertify buttons (copy customerfe app.component).
    alertify.defaults.transition = 'slide';
    alertify.defaults.theme.ok = 'btn btn-primary';
    alertify.defaults.theme.cancel = 'btn btn-danger';
    alertify.defaults.theme.input = 'form-control';

    // Alertify confirm dialog button default values.
    alertify.defaults.glossary.ok = this.i18n.t('alertify.ok');
    alertify.defaults.glossary.cancel = this.i18n.t('alertify.cancel');
  }
}
