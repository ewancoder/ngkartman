import { ChangeDetectionStrategy, Component, Input, ViewChild } from '@angular/core';
import { BehaviorSubject, catchError, combineLatest, defer, delay, finalize, iif, map, merge, Observable, of, race, raceWith, retry, share, startWith, Subject, switchMap, take, tap, timer } from 'rxjs';
import { SessionInfo, SessionService } from './session.service';
import { AsyncPipe } from '@angular/common';
import { SessionComponent } from './session.component';
import { LoaderComponent } from '../loader/loader.component';
import { ActivatedRoute, Router } from '@angular/router';
import flatpickr from 'flatpickr';

@Component({
    selector: 'kman-sessions',
    standalone: true,
    imports: [AsyncPipe, SessionComponent, LoaderComponent],
    templateUrl: './sessions.component.html',
    styleUrl: './sessions.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SessionsComponent {
    @Input({ required: true }) day!: string;
    @ViewChild('datepicker') datepickerElement!: any; // TODO: Use proper type here.
    sessions$: Observable<SessionInfo[]> | undefined;
    loading$: Observable<boolean> | undefined;
    shouldPoll: boolean = false;

    constructor(
        private sessionService: SessionService,
        private router: Router,
        private activatedRoute: ActivatedRoute) { }

    ngOnInit(): void {
        this.loadData();
    }

    ngAfterViewInit(): void {
        flatpickr(this.datepickerElement.nativeElement, {
            dateFormat: 'd-m-Y',
            onChange: (_, dateStr) => {
                this.reroute(dateStr);
            }
        });
    }

    private reroute(dateValue: string): void {
        this.router.navigate(['../', dateValue], { relativeTo: this.activatedRoute });
        this.day = dateValue;
        this.loadData();
    }

    private loadData() {
        if (this.day === 'today') {
            this.shouldPoll = true;
        } else {
            const [day, month, year] = this.day.split('-');
            const date = new Date(+year, +month - 1, +day);
            const now = new Date();

            this.shouldPoll = now.getDate() === date.getDate()
                && now.getMonth() === date.getMonth()
                && now.getFullYear() === date.getFullYear();
        }

        const sessions$ = this.sessionService.getSessions(this.day);

        const loader = new Loader(sessions$);

        this.loading$ = loader.loading$;

        // TODO: Refactor duplicated code.
        const polledData$ = timer(0, 20000).pipe(
            switchMap(() => loader.data$),
            retry(3),
            share()
        );

        this.sessions$ = this.shouldPoll
            ? polledData$
            : loader.data$;
    }
}

export class Loader<TResponse> {
    data$: Observable<TResponse>;
    loading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    // TODO: Handle errors.
    constructor(private source$: Observable<TResponse>, delay: number = 500) {
        let isLoading = true;

        // TODO: Very bad hack. Incorporate this into an observable instead.
        // And get rid of this race condition.
        // Furthermore, it will show a loader forever if nobody subscribes to sessions$.
        setTimeout(() => {
            if (isLoading) {
                this.loading$.next(true);
            }
        }, delay);

        this.data$ = source$.pipe(
            tap(() => { isLoading = false; this.loading$.next(false); }),
            share()
        );
    }
}
