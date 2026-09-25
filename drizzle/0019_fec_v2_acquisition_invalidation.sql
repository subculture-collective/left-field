BEGIN;

DROP TRIGGER IF EXISTS fec_v2_nationwide_finance_fec_v2_acquisition_outcomes ON public.fec_v2_acquisition_outcomes;
CREATE TRIGGER fec_v2_nationwide_finance_fec_v2_acquisition_outcomes
AFTER INSERT OR UPDATE OR DELETE ON public.fec_v2_acquisition_outcomes
FOR EACH ROW EXECUTE FUNCTION public.guard_nationwide_content('finance');

DROP TRIGGER IF EXISTS fec_v2_nationwide_finance_fec_v2_acquisition_receipts ON public.fec_v2_acquisition_receipts;
CREATE TRIGGER fec_v2_nationwide_finance_fec_v2_acquisition_receipts
AFTER INSERT OR UPDATE OR DELETE ON public.fec_v2_acquisition_receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_nationwide_content('finance');

DROP TRIGGER IF EXISTS fec_v2_nationwide_finance_fec_v2_acquisition_seals ON public.fec_v2_acquisition_seals;
CREATE TRIGGER fec_v2_nationwide_finance_fec_v2_acquisition_seals
AFTER INSERT OR UPDATE OR DELETE ON public.fec_v2_acquisition_seals
FOR EACH ROW EXECUTE FUNCTION public.guard_nationwide_content('finance');

DELETE FROM public.nationwide_validation_gates g
USING public.data_releases r
WHERE g.release_id=r.id AND r.status='candidate';

DELETE FROM public.release_content_digests d
USING public.data_releases r
WHERE d.release_id=r.id AND d.domain='finance' AND r.status='candidate';

UPDATE public.release_manifests m
SET validated_at=NULL
FROM public.data_releases r
WHERE m.release_id=r.id AND r.status='candidate';

COMMIT;
