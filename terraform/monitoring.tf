resource "aws_sns_topic" "alarms" {
  name              = "${local.name}-alarms"
  kms_master_key_id = aws_kms_key.main.id
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

locals {
  alarms = {
    alb-5xx = {
      namespace  = "AWS/ApplicationELB"
      metric     = "HTTPCode_Target_5XX_Count"
      statistic  = "Sum"
      threshold  = 10
      comparison = "GreaterThanThreshold"
      dimensions = { LoadBalancer = aws_lb.main.arn_suffix }
      text       = "App returned more than 10 server errors in 5 minutes"
    }
    unhealthy-targets = {
      namespace  = "AWS/ApplicationELB"
      metric     = "UnHealthyHostCount"
      statistic  = "Maximum"
      threshold  = 0
      comparison = "GreaterThanThreshold"
      dimensions = { LoadBalancer = aws_lb.main.arn_suffix, TargetGroup = aws_lb_target_group.app.arn_suffix }
      text       = "At least one app task is failing health checks"
    }
    db-cpu = {
      namespace  = "AWS/RDS"
      metric     = "CPUUtilization"
      statistic  = "Average"
      threshold  = 80
      comparison = "GreaterThanThreshold"
      dimensions = { DBInstanceIdentifier = aws_db_instance.main.identifier }
      text       = "Database CPU above 80%"
    }
    db-storage = {
      namespace  = "AWS/RDS"
      metric     = "FreeStorageSpace"
      statistic  = "Minimum"
      threshold  = 2 * 1024 * 1024 * 1024
      comparison = "LessThanThreshold"
      dimensions = { DBInstanceIdentifier = aws_db_instance.main.identifier }
      text       = "Less than 2 GB of database storage left"
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "this" {
  for_each            = local.alarms
  alarm_name          = "${local.name}-${each.key}"
  alarm_description   = each.value.text
  namespace           = each.value.namespace
  metric_name         = each.value.metric
  statistic           = each.value.statistic
  threshold           = each.value.threshold
  comparison_operator = each.value.comparison
  dimensions          = each.value.dimensions
  period              = 300
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}
