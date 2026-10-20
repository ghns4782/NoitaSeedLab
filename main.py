if __name__=='__main__':
    import sys,os
    if '--engine-owner-probe' in sys.argv:
        from noitatool.process_probe import hold_engine
        raise SystemExit(hold_engine(sys.argv[sys.argv.index('--engine-owner-probe')+1]))
    if '--self-test' in sys.argv:
        os.environ['QT_QPA_PLATFORM']='offscreen'
        from noitatool.frozen_smoke import run
        raise SystemExit(run(sys.argv[sys.argv.index('--self-test')+1]))
    from noitatool.app import main
    raise SystemExit(main())
